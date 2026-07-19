import type { RunLedger, RunLedgerRow } from '../../seams/run-ledger.js';
import { assertObservationInvariant, type TerminalObservation } from './terminal-state.js';

// The engine's trivial DEFAULT RunLedger — in-memory (Map-backed), sqlite-free, mirroring
// `InMemoryUnitRepository`. It holds no durability (no crash-resume), so it is for the
// fake/test path (and any run that need not survive a restart); the durable
// `SqliteRunLedger` is wired at the eval / composition edge. Single-threaded JS makes each
// `recordTerminal` atomic by construction, and writes are idempotent per (run_id, voice_id)
// — replace, never duplicate (P5). Findings are held only when the state is
// answered-with-findings (G-1 persistence half, via `assertObservationInvariant`).

export class InMemoryRunLedger implements RunLedger {
  private readonly rows = new Map<string, RunLedgerRow>();
  private readonly findings = new Map<string, readonly unknown[]>();
  private readonly quarantine = new Map<string, number>();
  private readonly calls = new Map<string, number>();

  private static key(runId: string, voiceId: string): string {
    return `${runId} ${voiceId}`;
  }

  recordTerminal(runId: string, voiceId: string, obs: TerminalObservation<unknown>): Promise<void> {
    assertObservationInvariant(obs);
    const key = InMemoryRunLedger.key(runId, voiceId);
    this.rows.set(key, {
      voiceId,
      state: obs.state,
      reasonCode: obs.reasonCode,
      ...(obs.invariantViolation !== undefined ? { invariantViolation: obs.invariantViolation } : {}),
    });
    if (obs.state === 'answered-with-findings') {
      this.findings.set(key, [...obs.findings]);
    } else {
      this.findings.delete(key);
    }
    this.quarantine.set(key, obs.quarantined.length);
    return Promise.resolve();
  }

  getRow(runId: string, voiceId: string): Promise<RunLedgerRow | undefined> {
    return Promise.resolve(this.rows.get(InMemoryRunLedger.key(runId, voiceId)));
  }

  terminalVoiceIds(runId: string): Promise<Set<string>> {
    return Promise.resolve(new Set(this.rowsForRun(runId).map((r) => r.voiceId)));
  }

  allRows(runId: string): Promise<readonly RunLedgerRow[]> {
    return Promise.resolve(this.rowsForRun(runId).sort((a, b) => a.voiceId.localeCompare(b.voiceId)));
  }

  invariantViolations(runId: string): Promise<readonly RunLedgerRow[]> {
    return Promise.resolve(
      this.rowsForRun(runId)
        .filter((r) => r.invariantViolation !== undefined)
        .sort((a, b) => a.voiceId.localeCompare(b.voiceId)),
    );
  }

  findingsFor(runId: string, voiceId: string): Promise<readonly unknown[]> {
    return Promise.resolve(this.findings.get(InMemoryRunLedger.key(runId, voiceId)) ?? []);
  }

  findingCount(runId: string): Promise<number> {
    let count = 0;
    for (const [key, list] of this.findings) if (key.startsWith(`${runId} `)) count += list.length;
    return Promise.resolve(count);
  }

  voicesWithFindings(runId: string): Promise<readonly string[]> {
    const ids: string[] = [];
    for (const [key, list] of this.findings) {
      if (key.startsWith(`${runId} `) && list.length > 0) ids.push(key.slice(runId.length + 1));
    }
    return Promise.resolve(ids);
  }

  quarantineCount(runId: string): Promise<number> {
    let count = 0;
    for (const [key, n] of this.quarantine) if (key.startsWith(`${runId} `)) count += n;
    return Promise.resolve(count);
  }

  logCall(runId: string, voiceId: string, attempt: number, phase: number): Promise<void> {
    const key = `${runId} ${voiceId} ${phase} ${attempt}`;
    this.calls.set(key, (this.calls.get(key) ?? 0) + 1);
    return Promise.resolve();
  }

  callCount(runId: string, voiceId: string, phase: number): Promise<number> {
    const prefix = `${runId} ${voiceId} ${phase} `;
    let count = 0;
    for (const key of this.calls.keys()) if (key.startsWith(prefix)) count += 1;
    return Promise.resolve(count);
  }

  close(): void {
    // Nothing to release — in-memory.
  }

  private rowsForRun(runId: string): RunLedgerRow[] {
    const prefix = `${runId} `;
    const out: RunLedgerRow[] = [];
    for (const [key, row] of this.rows) if (key.startsWith(prefix)) out.push(row);
    return out;
  }
}
