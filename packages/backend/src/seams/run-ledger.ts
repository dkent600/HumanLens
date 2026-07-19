import type {
  ReasonCode,
  TerminalObservation,
  TerminalState,
} from '../engine/completeness/terminal-state.js';

// The RUN-LEDGER seam INTERFACE — the persistent completeness accounting behind an
// abstraction, so the ENGINE (the voice orchestrator, the per-voice lenses) depends on
// this interface, never on a store (the same discipline as the repository seam). This
// module is deliberately store-free (no node:sqlite), so importing the interface — or the
// in-memory default — never pulls in the sqlite builtin. Two implementations live beside
// it: `SqliteRunLedger` (durable, seams/sqlite-run-ledger.ts) for the eval / real path,
// and `InMemoryRunLedger` (engine/completeness/in-memory-run-ledger.ts) as the engine's
// trivial default for the fake/test path.
//
// KEYED (run_id, voice_id) with ONE WRITER PER RUN (run-scoping): two overlapping runs of
// one engagement produce different stochastic findings for the same voice; the composite
// key keeps each run's accounting isolated. `recordTerminal` is atomic and the write of a
// terminal row precedes/accompanies finding persistence, with findings persisted IFF the
// state is answered-with-findings (G-1 persistence half) — so no finding can exist the
// ledger cannot account for.

/** A ledger row as read back — one voice's terminal disposition in one run. */
export interface RunLedgerRow {
  readonly voiceId: string;
  readonly state: TerminalState;
  readonly reasonCode: ReasonCode;
  /** A per-lens completeness-invariant breach recorded alongside the (truthful) state; absent = none. */
  readonly invariantViolation?: string;
}

/**
 * The seam interface. Async-shaped like every seam (real-store-ready). The sqlite
 * implementation resolves synchronously, which under single-threaded JS also serializes
 * writes — each `recordTerminal` is one atomic transaction even under a concurrent fan-out.
 */
export interface RunLedger {
  /** Record a voice's terminal disposition — atomic; idempotent per (run, voice) (P5). */
  recordTerminal(runId: string, voiceId: string, obs: TerminalObservation<unknown>): Promise<void>;
  getRow(runId: string, voiceId: string): Promise<RunLedgerRow | undefined>;
  /** Voices already terminal in this run — the resume skip-set (P8: not re-run). */
  terminalVoiceIds(runId: string): Promise<Set<string>>;
  /** Every terminal row for a run — the basis for P1 totality and the run report (P6). */
  allRows(runId: string): Promise<readonly RunLedgerRow[]>;
  /** Rows carrying a completeness-invariant violation — the surfaced-for-review set. */
  invariantViolations(runId: string): Promise<readonly RunLedgerRow[]>;
  /** The findings persisted for one voice (empty unless answered-with-findings). */
  findingsFor(runId: string, voiceId: string): Promise<readonly unknown[]>;
  findingCount(runId: string): Promise<number>;
  voicesWithFindings(runId: string): Promise<readonly string[]>;
  quarantineCount(runId: string): Promise<number>;
  /** Append one model-call record with its run PHASE — the crash test's no-re-execution proof. */
  logCall(runId: string, voiceId: string, attempt: number, phase: number): Promise<void>;
  callCount(runId: string, voiceId: string, phase: number): Promise<number>;
  close(): void;
}
