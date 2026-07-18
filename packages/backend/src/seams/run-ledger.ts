import { createRequire } from 'node:module';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import {
  assertObservationInvariant,
  type ReasonCode,
  type TerminalObservation,
  type TerminalState,
} from '../engine/completeness/terminal-state.js';

// The RUN-LEDGER seam — the persistent completeness accounting behind an interface, so
// the ENGINE (the voice orchestrator) depends on an abstraction, never on a database
// (the same discipline as the repository seam). The concrete implementation below is
// node:sqlite; a different store can drop in behind the interface without touching the
// orchestrator. Promoted from the V-1 validator's ledger, which property-proved this
// shape (P5/P6/P8, G-1 persistence, run-scoping, crash-resume) before adoption.
//
// KEYED (run_id, voice_id) with ONE WRITER PER RUN (run-scoping): two overlapping runs
// of one engagement produce different stochastic findings for the same voice; the
// composite key keeps each run's accounting isolated instead of interleaving two
// accountings into one corrupted ledger.
//
// THE ATOMICITY INVARIANT (G-1 persistence half): `recordTerminal` writes the ledger row
// and the findings in ONE transaction, and findings are written IFF the state is
// answered-with-findings — so no finding can exist that the ledger cannot account for,
// and a truncated partial never becomes authoritative. Findings are stored as JSON
// (the ledger is lens-agnostic and never looks inside one).

/** A ledger row as read back — one voice's terminal disposition in one run. */
export interface RunLedgerRow {
  readonly voiceId: string;
  readonly state: TerminalState;
  readonly reasonCode: ReasonCode;
}

/**
 * The seam interface. Async-shaped like every seam (real-store-ready); the sqlite
 * implementation resolves synchronously, which under single-threaded JS also serializes
 * writes — each `recordTerminal` is one atomic transaction even under a concurrent
 * fan-out.
 */
export interface RunLedger {
  /** Record a voice's terminal disposition — atomic; idempotent per (run, voice) (P5). */
  recordTerminal(runId: string, voiceId: string, obs: TerminalObservation<unknown>): Promise<void>;
  getRow(runId: string, voiceId: string): Promise<RunLedgerRow | undefined>;
  /** Voices already terminal in this run — the resume skip-set (P8: not re-run). */
  terminalVoiceIds(runId: string): Promise<Set<string>>;
  /** Every terminal row for a run — the basis for P1 totality and the run report (P6). */
  allRows(runId: string): Promise<readonly RunLedgerRow[]>;
  /** The findings persisted for one voice (JSON-parsed; empty unless answered-with-findings). */
  findingsFor(runId: string, voiceId: string): Promise<readonly unknown[]>;
  findingCount(runId: string): Promise<number>;
  voicesWithFindings(runId: string): Promise<readonly string[]>;
  quarantineCount(runId: string): Promise<number>;
  /** Append one model-call record with its run PHASE — the crash test's no-re-execution proof. */
  logCall(runId: string, voiceId: string, attempt: number, phase: number): Promise<void>;
  callCount(runId: string, voiceId: string, phase: number): Promise<number>;
  close(): void;
}

// node:sqlite is loaded via createRequire rather than a static `import`: it is a newer
// Node builtin that Vite (vitest's bundler) does not yet recognize and fails to resolve;
// createRequire hands it straight to Node, so the same code runs under vitest and plain
// Node. It needs Node >= 22.5 (experimental builtin) — the guard turns "wrong Node" into
// an actionable error instead of a cryptic resolution failure.
const MIN_NODE = { major: 22, minor: 5 };

function loadDatabaseSync(): typeof import('node:sqlite') {
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
  if (!(major > MIN_NODE.major || (major === MIN_NODE.major && minor >= MIN_NODE.minor))) {
    throw new Error(
      `The run ledger needs Node >= ${MIN_NODE.major}.${MIN_NODE.minor} for the node:sqlite builtin, ` +
        `but this runtime is Node ${process.versions.node}.`,
    );
  }
  return createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
}

const { DatabaseSync } = loadDatabaseSync();

/**
 * The node:sqlite implementation. `location` is REQUIRED — a production caller decides
 * where the accounting lives (a file for durability; ':memory:' is for tests). File-backed
 * ledgers run WAL + synchronous=FULL: every COMMIT fsyncs, so a committed row survives a
 * hard process kill — what the crash/SIGKILL-resume acceptance test relies on (P8).
 */
export class SqliteRunLedger implements RunLedger {
  private readonly db: DatabaseSyncType;

  constructor(location: string) {
    this.db = new DatabaseSync(location);
    if (location !== ':memory:') {
      this.db.exec('PRAGMA journal_mode = WAL');
      this.db.exec('PRAGMA synchronous = FULL');
    }
    this.db.exec(SCHEMA);
  }

  recordTerminal(runId: string, voiceId: string, obs: TerminalObservation<unknown>): Promise<void> {
    assertObservationInvariant(obs);
    this.tx(() => {
      this.db.prepare('DELETE FROM findings WHERE run_id = ? AND voice_id = ?').run(runId, voiceId);
      this.db.prepare('DELETE FROM quarantine WHERE run_id = ? AND voice_id = ?').run(runId, voiceId);
      this.db
        .prepare('INSERT OR REPLACE INTO ledger (run_id, voice_id, state, reason_code) VALUES (?, ?, ?, ?)')
        .run(runId, voiceId, obs.state, obs.reasonCode);
      if (obs.state === 'answered-with-findings') {
        const insert = this.db.prepare(
          'INSERT INTO findings (run_id, voice_id, seq, finding_json) VALUES (?, ?, ?, ?)',
        );
        obs.findings.forEach((finding, seq) => insert.run(runId, voiceId, seq, JSON.stringify(finding)));
      }
      const quarantine = this.db.prepare(
        'INSERT INTO quarantine (run_id, voice_id, seq, claimed_voice_id, reason) VALUES (?, ?, ?, ?, ?)',
      );
      obs.quarantined.forEach((q, seq) => quarantine.run(runId, voiceId, seq, q.claimedVoiceId, q.reason));
    });
    return Promise.resolve();
  }

  getRow(runId: string, voiceId: string): Promise<RunLedgerRow | undefined> {
    const row = this.db
      .prepare('SELECT voice_id, state, reason_code FROM ledger WHERE run_id = ? AND voice_id = ?')
      .get(runId, voiceId) as unknown as RawRow | undefined;
    return Promise.resolve(row ? toRow(row) : undefined);
  }

  terminalVoiceIds(runId: string): Promise<Set<string>> {
    const rows = this.db
      .prepare('SELECT voice_id FROM ledger WHERE run_id = ?')
      .all(runId) as unknown as { voice_id: string }[];
    return Promise.resolve(new Set(rows.map((r) => r.voice_id)));
  }

  allRows(runId: string): Promise<readonly RunLedgerRow[]> {
    const rows = this.db
      .prepare('SELECT voice_id, state, reason_code FROM ledger WHERE run_id = ? ORDER BY voice_id')
      .all(runId) as unknown as RawRow[];
    return Promise.resolve(rows.map(toRow));
  }

  findingsFor(runId: string, voiceId: string): Promise<readonly unknown[]> {
    const rows = this.db
      .prepare('SELECT finding_json FROM findings WHERE run_id = ? AND voice_id = ? ORDER BY seq')
      .all(runId, voiceId) as unknown as { finding_json: string }[];
    return Promise.resolve(rows.map((r) => JSON.parse(r.finding_json) as unknown));
  }

  findingCount(runId: string): Promise<number> {
    const row = this.db
      .prepare('SELECT COUNT(*) AS c FROM findings WHERE run_id = ?')
      .get(runId) as unknown as { c: number };
    return Promise.resolve(row.c);
  }

  voicesWithFindings(runId: string): Promise<readonly string[]> {
    const rows = this.db
      .prepare('SELECT DISTINCT voice_id FROM findings WHERE run_id = ?')
      .all(runId) as unknown as { voice_id: string }[];
    return Promise.resolve(rows.map((r) => r.voice_id));
  }

  quarantineCount(runId: string): Promise<number> {
    const row = this.db
      .prepare('SELECT COUNT(*) AS c FROM quarantine WHERE run_id = ?')
      .get(runId) as unknown as { c: number };
    return Promise.resolve(row.c);
  }

  logCall(runId: string, voiceId: string, attempt: number, phase: number): Promise<void> {
    this.db
      .prepare('INSERT INTO calls (run_id, voice_id, attempt, phase) VALUES (?, ?, ?, ?)')
      .run(runId, voiceId, attempt, phase);
    return Promise.resolve();
  }

  callCount(runId: string, voiceId: string, phase: number): Promise<number> {
    const row = this.db
      .prepare('SELECT COUNT(*) AS c FROM calls WHERE run_id = ? AND voice_id = ? AND phase = ?')
      .get(runId, voiceId, phase) as unknown as { c: number };
    return Promise.resolve(row.c);
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

interface RawRow {
  readonly voice_id: string;
  readonly state: string;
  readonly reason_code: string;
}

function toRow(row: RawRow): RunLedgerRow {
  return {
    voiceId: row.voice_id,
    state: row.state as TerminalState,
    reasonCode: row.reason_code as ReasonCode,
  };
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
  run_id       TEXT NOT NULL,
  voice_id     TEXT NOT NULL,
  seq          INTEGER NOT NULL,
  finding_json TEXT NOT NULL,
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
