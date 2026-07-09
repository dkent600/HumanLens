import type { Ledger } from './ledger.js';
import type { VoiceModel } from './model-call.js';
import { exhausted, retryability, type TerminalObservation } from './terminal-state.js';
import { observeVoiceCall } from './voice-call-adapter.js';

// The minimal per-voice FAN-OUT orchestrator — ONE call per voice, keyed by voice id,
// behind the lens↔model seam (build_context.md, Item 5 mechanism / V-1). This is the
// eval-scaffolding that TESTS the completeness guarantee; it is not the adopted mechanism.
//
// The load-bearing shape: the fan-out removes the failure-generating step (a batched call
// the model can silently skip a voice in). Every voice gets its own call, its own adapter
// verdict, and its own atomic ledger commit — so a drop cannot be silent; it manifests as
// delivered-but-unusable or failed, never as an unaccounted voice.
//
// DELIBERATE SCOPE NOTE (surfaced, not silent): the drive here is SEQUENTIAL. Concurrency
// (a p-limit-style limiter) is the mechanism recommendation's PERFORMANCE axis and is
// orthogonal to the accounting properties P1–P9 — every property is about per-voice
// accounting, not wall-clock. Sequential drive keeps seeded runs deterministic (so
// fast-check can shrink). If the mechanism is adopted, concurrency is added there, behind
// the same per-voice accounting.

export interface Caps {
  /** Max MODEL-layer retries for a delivered-but-unusable response before it becomes a gap. */
  readonly modelRetries: number;
  /** Max INFRA-layer retries for a failed(transport) response before it becomes a gap. */
  readonly infraRetries: number;
}

/** Bounded caps at BOTH layers — the guarantee the run terminates (P9). */
export const DEFAULT_CAPS: Caps = { modelRetries: 3, infraRetries: 3 };

export interface FanOutParams {
  readonly runId: string;
  readonly voiceIds: readonly string[];
  readonly model: VoiceModel;
  readonly ledger: Ledger;
  readonly caps?: Caps;
  /**
   * Every voice in the run — the provenance world used to tell a foreign valid id (g)
   * from an unknown one (e). Defaults to the run's own voiceIds.
   */
  readonly knownVoiceIds?: ReadonlySet<string>;
  /** Called after each model attempt (before the verdict) — the crash harness logs calls here. */
  readonly onAttempt?: (voiceId: string, attempt: number) => void;
  /** Called after each voice's terminal commit — the crash harness triggers the kill here. */
  readonly onCommit?: (voiceId: string) => void;
}

/**
 * Drive every voice to a terminal ledger entry. RESUMABLE: voices already terminal in the
 * ledger for this run are skipped, not re-run (P8) — so a restart after a crash completes
 * only the unfinished voices. The whole thing provably ends: each voice is bounded by the
 * caps (P9), and the loop visits each voice once.
 */
export async function runFanOut(params: FanOutParams): Promise<void> {
  const caps = params.caps ?? DEFAULT_CAPS;
  const knownVoiceIds = params.knownVoiceIds ?? new Set(params.voiceIds);
  const alreadyTerminal = params.ledger.terminalVoiceIds(params.runId); // P8 resume skip-set

  for (const voiceId of params.voiceIds) {
    if (alreadyTerminal.has(voiceId)) continue; // completed voices are NOT re-run (P8)

    const observation = await driveVoice(params, voiceId, knownVoiceIds, caps);
    // The ONE atomic write: ledger row + findings together, findings iff answered-with-findings.
    params.ledger.recordTerminal(params.runId, voiceId, observation);
    params.onCommit?.(voiceId);
  }
}

/**
 * Drive a single voice to a FINAL terminal observation, applying the two-layer retry
 * policy within bounded caps:
 *   - answered-with-findings / answered-empty → terminal immediately (P7: empty is never
 *     retried — we simply return it on the first such response).
 *   - delivered-but-unusable → retry at the MODEL layer up to `modelRetries`, then a gap
 *     (reason retries-exhausted), state preserved.
 *   - failed(provider-rejected) → terminal immediately, no backoff (A7).
 *   - failed(transport) → retry at the INFRA layer up to `infraRetries`, then a gap.
 * Bounded on both counters, so the loop provably terminates (P9).
 */
async function driveVoice(
  params: FanOutParams,
  voiceId: string,
  knownVoiceIds: ReadonlySet<string>,
  caps: Caps,
): Promise<TerminalObservation> {
  let modelAttempts = 0;
  let infraAttempts = 0;
  let attempt = 0;

  for (;;) {
    params.onAttempt?.(voiceId, attempt);
    const observation = await observeVoiceCall(voiceId, knownVoiceIds, () =>
      params.model.call(params.runId, voiceId, attempt),
    );
    attempt += 1;

    const canRetry = retryability(observation);
    if (canRetry.modelLayer) {
      if (modelAttempts < caps.modelRetries) {
        modelAttempts += 1;
        continue;
      }
      return exhausted(observation); // model-layer cap hit → surfaced gap
    }
    if (canRetry.infraLayer) {
      if (infraAttempts < caps.infraRetries) {
        infraAttempts += 1;
        continue;
      }
      return exhausted(observation); // infra-layer cap hit → surfaced gap
    }
    // Neither layer may retry: answered-*, or a terminal failed(provider-rejected).
    return observation;
  }
}
