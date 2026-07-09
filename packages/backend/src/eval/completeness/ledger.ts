import { createRequire } from 'node:module';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import {
  assertObservationInvariant,
  type ReasonCode,
  type TerminalObservation,
  type TerminalState,
  type VoiceFinding,
} from './terminal-state.js';

// The PERSISTENT run ledger (build_context.md, "A3 durability"). Persistent from V-1 —
// the ledger is the accounting of record, and it must survive a process crash so that
// totality is RESTORABLE on restart (P8). Backed by node:sqlite's synchronous
// DatabaseSync, chosen for exactly this: a synchronous COMMIT lets a ledger write be
// atomic-with finding persistence, and WAL + synchronous=NORMAL is durable across an
// application crash (our SIGKILL scenario), which is what the resume acceptance test
// needs.
//
// KEYED BY (run_id, voice_id) — the run-scoping fix from the traceability pass. Two
// overlapping runs of one engagement produce different stochastic findings for the same
// voice; voice-id-only keys would interleave two accountings into one corrupted ledger.
// The composite key + one-writer-per-run keeps each run's accounting isolated (P1/P5/P6/P8
// asserted PER RUN). [Chosen over the single-active-run-per-engagement lock: it isolates
// concurrent runs without serializing an engagement — reported back per the relay.]
//
// THE ATOMICITY INVARIANT: `recordTerminal` writes the ledger row AND the findings in ONE
// transaction, and findings are written IFF the state is answered-with-findings (G-1
// persistence half). So no finding can exist that the ledger cannot account for, and a
// truncated partial never becomes authoritative.
//
// NODE VERSION NOTE (eval-tier only). `node:sqlite` (DatabaseSync) is an EXPERIMENTAL
// builtin available from Node 22.5.0. This completeness VALIDATOR therefore needs Node
// >= 22.5 to run (`npm run completeness` + the completeness tests). The PRODUCT engine and
// server do NOT — they still target the repo's `engines: ">=20"`; nothing under this folder
// ships in the server, so the root engines field is deliberately left at >=20. The guard
// below turns "wrong Node" into a clear, actionable error instead of a cryptic
// module-resolution failure.
//
// node:sqlite is loaded via createRequire rather than a static `import`: it is a newer Node
// builtin that Vite (vitest's bundler) does not yet recognize as a builtin and fails to
// resolve. createRequire hands it straight to Node, so the same code runs under vitest and
// under plain Node (the compiled dist / crash harness). It emits an ExperimentalWarning —
// expected and harmless for eval-tier scaffolding.

/** Minimum Node for the node:sqlite builtin — see the note above. */
const MIN_NODE = { major: 22, minor: 5 };

/** Fail fast with a clear, actionable message if the runtime predates node:sqlite. */
function assertNodeSupportsSqlite(): void {
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
  const ok = major > MIN_NODE.major || (major === MIN_NODE.major && minor >= MIN_NODE.minor);
  if (!ok) {
    throw new Error(
      `The completeness validator (eval-tier scaffolding) needs Node >= ${MIN_NODE.major}.${MIN_NODE.minor} ` +
        `for the experimental node:sqlite builtin, but this runtime is Node ${process.versions.node}. ` +
        `Only 'npm run completeness' and the completeness tests require this; the product engine/server ` +
        `still run on Node >= 20.`,
    );
  }
}

function loadDatabaseSync(): typeof import('node:sqlite') {
  assertNodeSupportsSqlite();
  try {
    return createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  } catch (err) {
    throw new Error(
      `Failed to load the node:sqlite builtin on Node ${process.versions.node}. It is experimental and ` +
        `available from Node ${MIN_NODE.major}.${MIN_NODE.minor}; ensure this runtime provides it. ` +
        `Original error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

const { DatabaseSync } = loadDatabaseSync();

/** A ledger row as read back — the voice's terminal disposition. */
export interface LedgerRow {
  readonly voiceId: string;
  readonly state: TerminalState;
  readonly reasonCode: ReasonCode;
}

export class Ledger {
  private readonly db: DatabaseSyncType;

  /**
   * @param location a file path for durability (the crash test), or ':memory:' for a
   *   fast, isolated ledger (property runs). In-memory ledgers skip WAL (not applicable).
   */
  constructor(location = ':memory:') {
    this.db = new DatabaseSync(location);
    if (location !== ':memory:') {
      // WAL + synchronous=FULL: every COMMIT fsyncs the write-ahead log, so a committed
      // ledger row survives a hard process kill (SIGKILL) — what the crash acceptance test
      // relies on. FULL over NORMAL here because durability, not throughput, is the point.
      this.db.exec('PRAGMA journal_mode = WAL');
      this.db.exec('PRAGMA synchronous = FULL');
    }
    this.db.exec(SCHEMA);
  }

  /**
   * Record a voice's terminal disposition — the ONE write path, atomic. Enforces the
   * persistence invariant first (findings only on answered-with-findings), then in a
   * single transaction replaces any prior rows for this (run, voice) — so a retry or a
   * resume re-write is idempotent (P5) — and persists findings only when earned (G-1).
   */
  recordTerminal(runId: string, voiceId: string, obs: TerminalObservation): void {
    assertObservationInvariant(obs);
    this.tx(() => {
      this.db.prepare('DELETE FROM findings WHERE run_id = ? AND voice_id = ?').run(runId, voiceId);
      this.db.prepare('DELETE FROM quarantine WHERE run_id = ? AND voice_id = ?').run(runId, voiceId);
      this.db
        .prepare(
          'INSERT OR REPLACE INTO ledger (run_id, voice_id, state, reason_code) VALUES (?, ?, ?, ?)',
        )
        .run(runId, voiceId, obs.state, obs.reasonCode);
      if (obs.state === 'answered-with-findings') {
        const insert = this.db.prepare(
          'INSERT INTO findings (run_id, voice_id, seq, noticing) VALUES (?, ?, ?, ?)',
        );
        obs.findings.forEach((f, seq) => insert.run(runId, voiceId, seq, f.noticing));
      }
      const quarantine = this.db.prepare(
        'INSERT INTO quarantine (run_id, voice_id, seq, claimed_voice_id, reason) VALUES (?, ?, ?, ?, ?)',
      );
      obs.quarantined.forEach((q, seq) =>
        quarantine.run(runId, voiceId, seq, q.claimedVoiceId, q.reason),
      );
    });
  }

  /** The terminal disposition for one voice, or undefined if it has none yet (still pending). */
  getRow(runId: string, voiceId: string): LedgerRow | undefined {
    const row = this.db
      .prepare('SELECT voice_id, state, reason_code FROM ledger WHERE run_id = ? AND voice_id = ?')
      .get(runId, voiceId) as unknown as RawLedgerRow | undefined;
    return row ? toLedgerRow(row) : undefined;
  }

  /** Voices already terminal in this run — the resume skip-set (P8: not re-run). */
  terminalVoiceIds(runId: string): Set<string> {
    const rows = this.db
      .prepare('SELECT voice_id FROM ledger WHERE run_id = ?')
      .all(runId) as unknown as { voice_id: string }[];
    return new Set(rows.map((r) => r.voice_id));
  }

  /** Every terminal row for a run — the basis for P1 totality and the report (P6). */
  allRows(runId: string): readonly LedgerRow[] {
    const rows = this.db
      .prepare('SELECT voice_id, state, reason_code FROM ledger WHERE run_id = ? ORDER BY voice_id')
      .all(runId) as unknown as RawLedgerRow[];
    return rows.map(toLedgerRow);
  }

  /** The findings persisted for one voice (empty unless it answered-with-findings). */
  findingsFor(runId: string, voiceId: string): readonly VoiceFinding[] {
    const rows = this.db
      .prepare('SELECT noticing FROM findings WHERE run_id = ? AND voice_id = ? ORDER BY seq')
      .all(runId, voiceId) as unknown as { noticing: string }[];
    return rows.map((r) => ({ voiceId, noticing: r.noticing }));
  }

  /** Total attributed findings persisted for a run (P6 report cross-check). */
  findingCount(runId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS c FROM findings WHERE run_id = ?')
      .get(runId) as unknown as { c: number };
    return row.c;
  }

  /**
   * Every (run, voice) that owns a findings row — used to assert the "no orphan finding"
   * half of G-1/P8: every findings row must have an answered-with-findings ledger row.
   */
  voicesWithFindings(runId: string): readonly string[] {
    const rows = this.db
      .prepare('SELECT DISTINCT voice_id FROM findings WHERE run_id = ?')
      .all(runId) as unknown as { voice_id: string }[];
    return rows.map((r) => r.voice_id);
  }

  quarantineCount(runId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS c FROM quarantine WHERE run_id = ?')
      .get(runId) as unknown as { c: number };
    return row.c;
  }

  // ── Call log — for the crash acceptance test's "no re-execution" proof (P8). Each
  //    model call is appended with the PHASE it happened in (1 = pre-crash, 2 = resume);
  //    the test then asserts no pre-crash-terminal voice has a phase-2 call.
  logCall(runId: string, voiceId: string, attempt: number, phase: number): void {
    this.db
      .prepare('INSERT INTO calls (run_id, voice_id, attempt, phase) VALUES (?, ?, ?, ?)')
      .run(runId, voiceId, attempt, phase);
  }

  callCount(runId: string, voiceId: string, phase: number): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS c FROM calls WHERE run_id = ? AND voice_id = ? AND phase = ?')
      .get(runId, voiceId, phase) as unknown as { c: number };
    return row.c;
  }

  close(): void {
    this.db.close();
  }

  /** Run `fn` inside an IMMEDIATE transaction; commit on success, roll back on any throw. */
  private tx(fn: () => void): void {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      fn();
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }
}

interface RawLedgerRow {
  readonly voice_id: string;
  readonly state: string;
  readonly reason_code: string;
}

function toLedgerRow(row: RawLedgerRow): LedgerRow {
  return { voiceId: row.voice_id, state: row.state as TerminalState, reasonCode: row.reason_code as ReasonCode };
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS ledger (
  run_id      TEXT NOT NULL,
  voice_id    TEXT NOT NULL,
  state       TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  PRIMARY KEY (run_id, voice_id)
);
CREATE TABLE IF NOT EXISTS findings (
  run_id   TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  seq      INTEGER NOT NULL,
  noticing TEXT NOT NULL,
  PRIMARY KEY (run_id, voice_id, seq)
);
CREATE TABLE IF NOT EXISTS quarantine (
  run_id           TEXT NOT NULL,
  voice_id         TEXT NOT NULL,
  seq              INTEGER NOT NULL,
  claimed_voice_id TEXT NOT NULL,
  reason           TEXT NOT NULL,
  PRIMARY KEY (run_id, voice_id, seq)
);
CREATE TABLE IF NOT EXISTS calls (
  run_id   TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  attempt  INTEGER NOT NULL,
  phase    INTEGER NOT NULL,
  PRIMARY KEY (run_id, voice_id, phase, attempt)
);
`;
