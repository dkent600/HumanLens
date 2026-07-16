// What the seam adapter sees BELOW the domain-agnostic lens↔model seam. This validator
// models the RICHER raw outcome the SDK actually produces — text PLUS finish reason,
// plus the transport/exception paths — so G-1 / finish-reason gating is testable.
//
// ▶ GOVERNANCE FINDING — RESOLVED (the fake-empty-drop seam fix landed): the production
//   seam is now `complete({system?,prompt}) -> {text, stopReason, httpStatus?}` and
//   `AnthropicLlmProvider` passes `stop_reason` through (the refusal → {text:''}
//   collapse is gone). This module keeps its OWN FinishReason vocabulary from the V-1
//   spec ('stop'/'length'/'content_filter'); aligning it to the Anthropic-native
//   vocabulary the production seam now uses is carried forward to the orchestrator
//   task, which will reconcile the eval adapter with the production routing.

/**
 * The model's finish reason. NATURAL completion is `stop` / `end_turn`; everything else
 * is non-natural and, by G-1(a), routes to delivered-but-unusable regardless of what
 * the body contains.
 *   - length         → the response was truncated (behavior i / k)
 *   - content_filter → the provider filtered the output (behavior k)
 *   - refusal        → the model declined (behavior d)
 */
export type FinishReason = 'stop' | 'end_turn' | 'length' | 'content_filter' | 'refusal';

/** The natural-completion reasons — the ONLY ones on which answered-* is reachable. */
export function isNaturalFinish(finishReason: FinishReason): boolean {
  return finishReason === 'stop' || finishReason === 'end_turn';
}

/**
 * A raw outcome the model call RETURNS (as opposed to throws). Either the provider
 * responded with a body + finish reason (HTTP 200), or it returned a non-2xx status.
 */
export type RawSdkOutcome =
  | { readonly kind: 'responded'; readonly finishReason: FinishReason; readonly body: string }
  | { readonly kind: 'http-error'; readonly status: number };

// ── The exceptions a real SDK/network path may THROW ────────────────────────────
// A9 demands the adapter map EVERY one of these (and any unexpected throw) to exactly
// one terminal state, with nothing escaping. They carry semantic intent so the mock can
// throw the right one and the adapter can route by type; an UNKNOWN throw is the real
// test of totality — the adapter must still not propagate it.

/** A network-level failure/timeout — no usable response was received. → failed(transport). */
export class TransportError extends Error {
  constructor(message = 'transport failure') {
    super(message);
    this.name = 'TransportError';
  }
}

/**
 * An exception while decoding/parsing the response payload the transport DID deliver
 * (a mid-stream decode blow-up). The model delivered something we cannot consume →
 * delivered-but-unusable, not a transport failure.
 */
export class StreamError extends Error {
  constructor(message = 'stream/parse failure') {
    super(message);
    this.name = 'StreamError';
  }
}

/** An exception during post-response teardown/cleanup. Treated as infra → failed(transport). */
export class TeardownError extends Error {
  constructor(message = 'teardown failure') {
    super(message);
    this.name = 'TeardownError';
  }
}

/**
 * One per-voice model call. Returns a raw outcome or THROWS (any of the errors above,
 * or something unexpected). Returns a Promise to mirror the async real seam; the fake
 * resolves synchronously so seeded runs stay deterministic and reproducible (critical
 * for fast-check shrinking). `attempt` is 0-based so the mock can script different
 * outcomes per retry (transport-then-valid, perpetual poison, …).
 */
export interface VoiceModel {
  call(runId: string, voiceId: string, attempt: number): Promise<RawSdkOutcome>;
}
