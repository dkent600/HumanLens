import type { Unit } from '../../domain/types.js';
import type { Finding } from '../../domain/finding.js';
import type { LlmProvider } from '../../seams/llm-provider.js';
import type { RunLedger } from '../../seams/run-ledger.js';
import { InMemoryRunLedger } from './in-memory-run-ledger.js';
import {
  runVoiceFanOut,
  type FanOutCaps,
  type VoiceOperation,
} from './voice-orchestrator.js';
import type { TerminalObservation } from './terminal-state.js';

// The bridge between a per-voice LENS (Listening, Human Meaning) and the lens-agnostic
// production ORCHESTRATOR. A per-voice lens no longer calls the model itself: it declares
// its voices and its per-voice VoiceOperation (its prompt, its tolerant parse, its finding
// shape, its provenance check, its completeness-invariant declaration), and this helper
// fans out through the orchestrator — one model call per voice, four-state ledger,
// retry/termination. The orchestrator stays lens-agnostic; all lens-specific behavior lives
// in the operation the lens supplies.

export interface PerVoiceLens<TFinding> {
  readonly id: string;
  /** The voice ids to fan out over, derived from this run's input (units or prior findings). */
  voiceIds(units: readonly Unit[], priorFindings: readonly Finding[]): readonly string[];
  /** The per-voice operation for this run — closes over the units/priorFindings and the voice set. */
  operation(
    units: readonly Unit[],
    priorFindings: readonly Finding[],
    provider: LlmProvider,
  ): VoiceOperation<TFinding>;
}

export interface PerVoiceRunOptions {
  readonly ledger?: RunLedger;
  readonly runId?: string;
  readonly concurrency?: number;
  readonly caps?: FanOutCaps;
  readonly infraBackoff?: (attempt: number) => Promise<void>;
  readonly onAttempt?: (voiceId: string, attempt: number) => void;
  readonly onCommit?: (voiceId: string) => void;
}

export interface PerVoiceRunResult<TFinding> {
  readonly findings: readonly TFinding[];
  readonly observations: ReadonlyMap<string, TerminalObservation<TFinding>>;
  readonly voiceIds: readonly string[];
  readonly ledger: RunLedger;
  readonly runId: string;
}

/**
 * Run a per-voice lens through the orchestrator and collect its answered-with-findings
 * output, in voice order. The ledger + runId default to a FRESH in-memory ledger and the
 * lens id — the ephemeral fake/test path (records produced but not persisted). The eval /
 * real path passes a durable `SqliteRunLedger` and a run-scoped id to persist and inspect
 * the (run_id, voice_id) records and any invariant violations.
 */
export async function runPerVoiceLens<TFinding>(
  lens: PerVoiceLens<TFinding>,
  units: readonly Unit[],
  priorFindings: readonly Finding[],
  provider: LlmProvider,
  options: PerVoiceRunOptions = {},
): Promise<PerVoiceRunResult<TFinding>> {
  const ledger = options.ledger ?? new InMemoryRunLedger();
  const runId = options.runId ?? lens.id;
  const voiceIds = lens.voiceIds(units, priorFindings);
  if (voiceIds.length === 0) {
    return { findings: [], observations: new Map(), voiceIds, ledger, runId };
  }
  const operation = lens.operation(units, priorFindings, provider);
  const observations = await runVoiceFanOut({
    runId,
    voiceIds,
    operation,
    ledger,
    ...(options.caps !== undefined ? { caps: options.caps } : {}),
    ...(options.concurrency !== undefined ? { concurrency: options.concurrency } : {}),
    ...(options.infraBackoff !== undefined ? { infraBackoff: options.infraBackoff } : {}),
    ...(options.onAttempt !== undefined ? { onAttempt: options.onAttempt } : {}),
    ...(options.onCommit !== undefined ? { onCommit: options.onCommit } : {}),
  });

  // Collect answered-with-findings output in voice order — a stable, deterministic sequence.
  const findings: TFinding[] = [];
  for (const voiceId of voiceIds) {
    const obs = observations.get(voiceId);
    if (obs !== undefined && obs.state === 'answered-with-findings') {
      findings.push(...obs.findings);
    }
  }
  return { findings, observations, voiceIds, ledger, runId };
}
