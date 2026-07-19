import { routeLlmResponse, type LlmResponse } from '../../seams/llm-provider.js';
import type { RunLedger } from '../../seams/run-ledger.js';
import {
  answeredEmpty,
  answeredWithFindings,
  deliveredButUnusable,
  exhausted,
  failed,
  retryability,
  withInvariantViolation,
  type QuarantinedFinding,
  type TerminalObservation,
} from './terminal-state.js';

// The PRODUCTION per-voice fan-out orchestrator (build_implementation.md, "Completeness —
// orchestration (adopted)"). Promoted from the V-1 validator, which property-proved this
// design (P1–P9, adapter totality, run-scoping, crash-resume) against a hostile model
// mock — the shapes here are the validated ones, hardened, not re-derived.
//
// One model call per voice, keyed by voice id: the model never receives a list, so
// per-call it cannot skip an item. Every voice's call resolves — totally — to exactly one
// of the four terminal states and is committed atomically to the persistent run ledger.
// A silently dropped voice is not a state a voice can be in.
//
// LENS-AGNOSTIC by design: the orchestrator takes voice IDS and a per-voice OPERATION
// (the model call through the fixed seam + the lens's tolerant parse). It never sees a
// prompt, a unit, or the inside of a finding — so the next task can hand it Listening or
// Human Meaning without the orchestrator knowing which. Plain TypeScript; the ledger is
// a SEAM (the engine depends on the abstraction, never on a database).
//
// CONCURRENCY: synchronous parallel fan-out with a bounded worker pool — the adopted
// first embodiment (a batch-API path is a later TRANSPORT swap behind the same seam,
// deliberately not built). Ledger writes stay atomic under concurrency because each
// recordTerminal is one synchronous sqlite transaction on one connection (one writer
// per run).

/**
 * What a lens's tolerant parse yields for a NATURAL-finish body:
 *  - `usable: true` — a well-formed answer. `findings` may legitimately be EMPTY (that,
 *    on a natural finish with nothing quarantined, is the genuine chosen-empty).
 *    `quarantined` reports candidates the parse rejected as misattributed — a finding
 *    naming a DIFFERENT valid voice (g) or an id never sent (e). The parse performs that
 *    provenance check because only it knows the finding shape (P3); the orchestrator
 *    records the quarantine and never attributes those findings anywhere.
 *  - `usable: false` — the body was delivered but is not an answer (unparseable /
 *    wrong-shaped): delivered-but-unusable, never answered-empty (P4).
 */
export type ParsedVoiceBody<TFinding> =
  | {
      readonly usable: true;
      readonly findings: readonly TFinding[];
      readonly quarantined?: readonly QuarantinedFinding[];
    }
  | { readonly usable: false };

/**
 * The per-voice operation — everything lens-specific, behind two functions:
 *  - `call` makes THE one model call for this voice through the fixed seam (it owns the
 *    prompt; the orchestrator owns the accounting). It may throw — transport errors and
 *    provider HTTP errors propagate per the seam convention; the orchestrator maps every
 *    throw to a terminal state (adapter totality).
 *  - `parse` turns a natural-finish body into the voice's findings (tolerant — it must
 *    not throw for bad model output, but if it ever does, the orchestrator still maps it
 *    to delivered-but-unusable rather than letting it escape).
 */
export interface VoiceOperation<TFinding> {
  call(voiceId: string): Promise<LlmResponse>;
  parse(text: string, voiceId: string): ParsedVoiceBody<TFinding>;
  /**
   * The lens's PER-VOICE COMPLETENESS INVARIANT: is an answered-empty terminal LEGITIMATE
   * for this voice? Absent → always legitimate (a lens with no such invariant). Returns
   * false when the lens's own contract forbids a silent voice here — Listening: an
   * authored voice must yield ≥1 finding (only non-authored emptiness may be empty);
   * Human Meaning: every voice yields ≥1 finding (its worth-exploring flag guarantees it).
   * When it returns false and the voice resolves answered-empty, the orchestrator records
   * an invariant violation on that record — it does NOT retry (P7) and does NOT reroute.
   */
  answeredEmptyLegitimate?(voiceId: string): boolean;
}

export interface FanOutCaps {
  /** Max MODEL-layer retries for a delivered-but-unusable response before it is a gap. */
  readonly modelRetries: number;
  /** Max INFRA-layer retries for a failed(transport) response before it is a gap. */
  readonly infraRetries: number;
}

/** Bounded caps at BOTH layers — what makes the run provably end (P9). */
export const DEFAULT_CAPS: FanOutCaps = { modelRetries: 3, infraRetries: 3 };

/** Default infra-layer backoff: 250ms · 2^(attempt-1), capped at 4s. Injectable for tests. */
export function defaultInfraBackoff(attempt: number): Promise<void> {
  const ms = Math.min(250 * 2 ** (attempt - 1), 4000);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface VoiceFanOutParams<TFinding> {
  readonly runId: string;
  readonly voiceIds: readonly string[];
  readonly operation: VoiceOperation<TFinding>;
  readonly ledger: RunLedger;
  readonly caps?: FanOutCaps;
  /** Worker-pool width for the synchronous parallel fan-out. Default 4. */
  readonly concurrency?: number;
  /** Infra-layer backoff between failed(transport) retries. Tests inject a no-op. */
  readonly infraBackoff?: (attempt: number) => Promise<void>;
  /** Called before each model attempt — the crash harness logs calls here. */
  readonly onAttempt?: (voiceId: string, attempt: number) => void;
  /** Called after each voice's atomic terminal commit — the crash harness kills here. */
  readonly onCommit?: (voiceId: string) => void;
}

/**
 * Drive every voice to a terminal ledger entry and return the observations by voice id.
 * RESUMABLE (P8): voices already terminal in the ledger for this run are skipped, never
 * re-run — a restart after a crash completes only the unfinished voices. Provably ends
 * (P9): each voice is bounded by the caps and each is visited once.
 */
export async function runVoiceFanOut<TFinding>(
  params: VoiceFanOutParams<TFinding>,
): Promise<ReadonlyMap<string, TerminalObservation<TFinding>>> {
  const caps = params.caps ?? DEFAULT_CAPS;
  const backoff = params.infraBackoff ?? defaultInfraBackoff;
  const alreadyTerminal = await params.ledger.terminalVoiceIds(params.runId);
  const pending = params.voiceIds.filter((id) => !alreadyTerminal.has(id));

  const results = new Map<string, TerminalObservation<TFinding>>();
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= pending.length) return;
      const voiceId = pending[index];
      const driven = await driveVoice(params, voiceId, caps, backoff);
      // Per-lens completeness invariant: a legitimately-declared-illegitimate answered-empty
      // is annotated with a violation — NOT retried (P7: never re-ask an empty), NOT
      // rerouted (the state stays truthfully answered-empty). Lens-agnostic: the
      // orchestrator only consults the operation's optional declaration.
      const observation =
        driven.state === 'answered-empty' &&
        params.operation.answeredEmptyLegitimate?.(voiceId) === false
          ? withInvariantViolation(driven, `answered-empty is illegitimate for this lens's completeness invariant`)
          : driven;
      // The ONE atomic write: ledger row + findings together, findings iff
      // answered-with-findings (G-1 persistence half).
      await params.ledger.recordTerminal(params.runId, voiceId, observation);
      results.set(voiceId, observation);
      params.onCommit?.(voiceId);
    }
  };
  const width = Math.max(1, Math.min(params.concurrency ?? 4, pending.length || 1));
  await Promise.all(Array.from({ length: width }, () => worker()));
  return results;
}

/**
 * Drive one voice to a FINAL terminal observation — a TOTAL function over everything the
 * seam and the operation can do (return, reject with a status, reject without one, throw
 * from parse): every path maps to exactly one of the four states; nothing escapes.
 * Retry policy (derived from the state, never per-call):
 *   answered-* → terminal immediately (P7: empty is never retried);
 *   delivered-but-unusable → immediate MODEL-layer retry up to the cap, then a gap;
 *   failed(provider-rejected) → terminal immediately, no backoff (A7);
 *   failed(transport) → INFRA-layer retry with backoff up to the cap, then a gap.
 */
async function driveVoice<TFinding>(
  params: VoiceFanOutParams<TFinding>,
  voiceId: string,
  caps: FanOutCaps,
  backoff: (attempt: number) => Promise<void>,
): Promise<TerminalObservation<TFinding>> {
  let modelAttempts = 0;
  let infraAttempts = 0;
  let attempt = 0;

  for (;;) {
    params.onAttempt?.(voiceId, attempt);
    const observation = await observeVoiceCall(params.operation, voiceId);
    attempt += 1;

    const canRetry = retryability(observation);
    if (canRetry.modelLayer) {
      if (modelAttempts < caps.modelRetries) {
        modelAttempts += 1;
        continue; // model-layer retry: re-ask immediately
      }
      return exhausted(observation);
    }
    if (canRetry.infraLayer) {
      if (infraAttempts < caps.infraRetries) {
        infraAttempts += 1;
        await backoff(infraAttempts);
        continue; // infra-layer retry: backoff first
      }
      return exhausted(observation);
    }
    return observation; // answered-*, or terminal failed(provider-rejected)
  }
}

/** One call + routing, total. Exported for the adapter-totality property tests. */
export async function observeVoiceCall<TFinding>(
  operation: VoiceOperation<TFinding>,
  voiceId: string,
): Promise<TerminalObservation<TFinding>> {
  let response: LlmResponse;
  try {
    response = await operation.call(voiceId);
  } catch (err) {
    // The seam convention: transport/API failures THROW. A provider HTTP status rides
    // the thrown error; a non-retryable 4xx (except 429) is terminal provider-rejected
    // with no backoff (A7); everything else — 429, 5xx, network, timeout, or any
    // unexpected throw — is retryable transport. Nothing re-throws: totality.
    const status = (err as { status?: unknown }).status;
    if (typeof status === 'number' && status >= 400 && status < 500 && status !== 429) {
      return failed('provider-rejected');
    }
    return failed('transport');
  }

  // G-1 routing half: answered-* is reachable only on a natural finish; any non-natural
  // finish routes unusable regardless of what the body would parse to.
  const route = routeLlmResponse(response);
  if (route.kind === 'unusable') {
    return deliveredButUnusable(route.reason === 'refused' ? 'refused' : 'malformed');
  }

  // Natural finish: the lens's tolerant parse decides. A parse that THROWS (it should
  // not, but totality does not depend on "should") is a delivered body we could not
  // consume — unusable, never a crash and never answered-empty.
  let parsed: ParsedVoiceBody<TFinding>;
  try {
    parsed = operation.parse(response.text, voiceId);
  } catch {
    return deliveredButUnusable('malformed');
  }
  if (!parsed.usable) {
    return deliveredButUnusable('malformed');
  }

  const quarantined = parsed.quarantined ?? [];
  if (parsed.findings.length > 0) {
    return answeredWithFindings(parsed.findings, quarantined);
  }
  if (quarantined.length > 0) {
    // The model emitted findings, but every one was for another/unknown voice (e / g).
    // NOT chosen silence: unusable, with the misattributions recorded, never silently
    // attributed anywhere (P3).
    return deliveredButUnusable('malformed', quarantined);
  }
  // A usable empty body on a natural finish — the genuine chosen-empty (P2/G-1).
  return answeredEmpty();
}
