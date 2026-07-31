import Anthropic from '@anthropic-ai/sdk';
import type { LlmProvider, LlmRequest, LlmResponse } from './llm-provider.js';

// The real LLM provider — the first real model in the system, behind the
// `complete({system?, prompt}) -> {text, stopReason, httpStatus?}` seam. It is a SECOND
// implementation alongside FakeLlmProvider; the seam stays domain-agnostic (prompt in,
// text + finish signal out — it knows nothing of units or findings). Surfacing the raw
// `stop_reason` is the committed fake-empty-drop seam fix (build_implementation.md,
// "Lens↔model contract"): the four-state accounting needs the finish signal to tell a
// chosen empty from a refusal/truncation, so this provider passes it through untouched.
// `httpStatus` stays unpopulated here: Anthropic's non-2xx outcomes THROW (and the
// status rides the thrown APIError), so there is no in-band status on the success path.
//
// Selection is env-driven and lives OUTSIDE buildContainer (see select-llm-provider.ts
// and the eval harness): buildContainer stays pure (the fake by default), so the whole
// test suite runs green with no key and no network. No test constructs this against the
// real API — the injectable client below lets tests drive the response->text mapping
// deterministically.

/**
 * The model the lenses run on — a single named constant, verified against the Claude
 * API reference at build time: `claude-opus-5`, the current default Opus-tier model.
 *
 * Changing this constant changes what every eval measures, so a baseline taken on one
 * model is NOT comparable to a run on another — re-baseline after a model change.
 * (Superseded `claude-opus-4-8` on 2026-07-31; prior real-run records in build_context.md
 * name the model they ran on and stand as history.)
 */
export const ANTHROPIC_MODEL = 'claude-opus-5';

/**
 * Output ceiling per call — the HARD cap on thinking + answer together.
 *
 * Raised 16000 -> 64000 on the move to `claude-opus-5`. On this model thinking is ALWAYS
 * ON (not opt-in) and `effort` defaults to `high`, and thinking tokens count against
 * `max_tokens` alongside the answer text. The binding case is the CROSS-VOICE call
 * (Culture Pattern): one synthesis over the whole accumulated pool, the largest single
 * call in the system, where deep reasoning is exactly what the task invites.
 *
 * The failure this prevents is SILENT, which is why the headroom is generous. A call that
 * exhausts the ceiling returns `stopReason: 'max_tokens'` -> routed delivered-but-unusable
 * -> the cross-voice path yields zero patterns. In the eval output that is
 * indistinguishable from a lens that legitimately found nothing (0% coverage, everything
 * residual, no defects) — so a truncation would be read as a finding about the lens.
 *
 * Billing is on tokens GENERATED, not on the ceiling, so unused headroom costs nothing.
 * Opus 5 permits up to 128k; 64000 leaves room without approaching the model limit.
 * Exported so the eval harness can report each call's distance from it.
 */
export const MAX_TOKENS = 64000;

/**
 * Reasoning depth. Pinned EXPLICITLY to `high` — which is the current Claude API default
 * for this model, so this changes nothing about behavior. It is here to make the eval
 * reproducible and self-describing: an unstated default is a parameter that can move under
 * a baseline without the run recording that it did. Pin it, record it, compare like with like.
 */
export const EFFORT = 'high' as const;

/**
 * The narrow slice of the Anthropic client this provider depends on. Declaring it as
 * an interface (rather than depending on the concrete client) lets a test inject a
 * deterministic stub for the response->text mapping, so no test makes a real network
 * call.
 */
export interface AnthropicMessagesClient {
  readonly messages: {
    create(body: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

export class AnthropicLlmProvider implements LlmProvider {
  // The default client reads ANTHROPIC_API_KEY from the environment. It is only
  // constructed when no stub is supplied — and selection only constructs this provider
  // when a key is present — so the default never runs in tests (which always inject a
  // stub) and never without a key.
  constructor(private readonly client: AnthropicMessagesClient = new Anthropic()) {}

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const message = await this.client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      // Adaptive thinking: qualitative synthesis benefits from it. On this model thinking
      // is always on and this config is the sanctioned form (manual `type:'enabled'` +
      // budget_tokens is REJECTED with a 400 here). We read only the text blocks below, so
      // whichever way `display` defaults, no thinking text reaches a lens.
      thinking: { type: 'adaptive' },
      // Reasoning depth, pinned rather than inherited — see EFFORT.
      output_config: { effort: EFFORT },
      messages: [{ role: 'user', content: request.prompt }],
      ...(request.system !== undefined ? { system: request.system } : {}),
    });

    // The SDK documents stop_reason as non-null on the non-streaming path; a null here
    // is an SDK anomaly, and a response whose finish cannot be certified must not be
    // routed as if it finished naturally. It propagates like any infra failure —
    // surfaced, retryable at the infra layer — never disguised as an answer.
    if (message.stop_reason === null) {
      throw new Error(
        'Anthropic returned a message with no stop_reason (unexpected on the non-streaming path)',
      );
    }

    // The finish signal is passed THROUGH, refusal included — deliberately. The prior
    // mapping (refusal -> {text:''}) was the fake-empty drop: a refusal arrived as
    // empty text, indistinguishable from a chosen empty, was recorded answered-empty,
    // and was never retried — a permanently, silently dropped voice. The caller now
    // routes by `stopReason` (routeLlmResponse): a refusal lands delivered-but-unusable,
    // never answered-empty. Transport/API errors are still NOT caught here; they
    // propagate per the seam convention (the SDK retries 429/5xx/network first).
    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    return {
      text,
      stopReason: message.stop_reason,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        ...(message.usage.cache_read_input_tokens !== null
          ? { cacheReadInputTokens: message.usage.cache_read_input_tokens }
          : {}),
        ...(message.usage.cache_creation_input_tokens !== null
          ? { cacheCreationInputTokens: message.usage.cache_creation_input_tokens }
          : {}),
        // How much of the output was internal reasoning. Optional-chained: the field is
        // absent on models/responses that report no thinking breakdown, and a missing
        // breakdown must not be reported as zero thinking.
        ...(message.usage.output_tokens_details?.thinking_tokens !== undefined
          ? { thinkingTokens: message.usage.output_tokens_details.thinking_tokens }
          : {}),
      },
    };
  }
}
