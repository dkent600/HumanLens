import type Anthropic from '@anthropic-ai/sdk';
import { AnthropicLlmProvider, type AnthropicMessagesClient } from '../../../seams/anthropic-llm-provider.js';
import { observeVoiceCall } from '../voice-call-adapter.js';
import type { TerminalObservation } from '../terminal-state.js';
import type { RawSdkOutcome } from '../model-call.js';
import { finishReasonOf, PER_VOICE_SYSTEM, buildUserPrompt } from './anthropic-voice-model.js';

// The PURE core of F1-b (the ★ demonstration) — no top-level side effects, so the offline
// test can drive it with a synthetic truncated Message and no network / no key. The CLI
// (f1b-star.ts) makes the one real call and hands the captured Message here.
//
// HISTORICAL NOTE (the fix landed): the fake-empty-drop seam fix means the production
// seam now SURFACES `stopReason` (and no longer collapses a refusal to `{text:''}`).
// PATH 1 below therefore no longer models the seam itself — it models a consumer that
// IGNORES the surfaced signal, i.e. the pre-fix world. It is kept as the record of the
// drop the fix closed; the delta against PATH 2 is what ★ was.

/** A stub client that always returns a captured Message — re-runs the SAME response through
 *  the production seam without a second network call (and drives the offline test). */
export function stubClientReturning(message: Anthropic.Message): AnthropicMessagesClient {
  return { messages: { create: () => Promise.resolve(message) } };
}

export interface TwoPathResult {
  readonly realStopReason: Anthropic.StopReason | null;
  readonly bodyText: string;
  /** The production seam's output — {text} only; it has no stop_reason field at all. */
  readonly productionSeamText: string;
  /** PATH 1: production consumer, forced to assume a natural finish (stop_reason was discarded). */
  readonly path1ProductionSeam: TerminalObservation;
  /** PATH 2: total adapter, with the real stop_reason available. */
  readonly path2TotalAdapter: TerminalObservation;
}

/**
 * Contrast the two accounting paths on ONE captured Message. The production seam is exercised
 * for real (via a stub returning this same message) to prove it yields only {text}; the total
 * adapter is fed the real stop_reason. The ONLY difference between the paths is whether
 * stop_reason was available — that delta is ★.
 */
export async function contrastPaths(
  message: Anthropic.Message,
  voiceId: string,
  knownVoiceIds: ReadonlySet<string>,
): Promise<TwoPathResult> {
  // PATH 1 — the identical response through the REAL production seam, read the PRE-FIX
  // way: only `text` is consumed (the surfaced `stopReason` is deliberately ignored, as
  // the old seam forced every consumer to do).
  const production = new AnthropicLlmProvider(stubClientReturning(message));
  const { text: productionSeamText } = await production.complete({
    system: PER_VOICE_SYSTEM,
    prompt: buildUserPrompt(voiceId, 'irrelevant — the stub returns the captured message'),
  });
  // A signal-blind consumer must assume natural completion:
  const path1ProductionSeam = await observeVoiceCall(voiceId, knownVoiceIds, () =>
    Promise.resolve<RawSdkOutcome>({ kind: 'responded', finishReason: 'end_turn', body: productionSeamText }),
  );

  // PATH 2 — the total adapter, with the REAL stop_reason.
  const bodyText = textOf(message);
  const path2TotalAdapter = await observeVoiceCall(voiceId, knownVoiceIds, () =>
    Promise.resolve<RawSdkOutcome>({
      kind: 'responded',
      finishReason: finishReasonOf(message.stop_reason),
      body: bodyText,
    }),
  );

  return {
    realStopReason: message.stop_reason,
    bodyText,
    productionSeamText,
    path1ProductionSeam,
    path2TotalAdapter,
  };
}

export function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}
