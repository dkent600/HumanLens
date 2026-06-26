import Anthropic from '@anthropic-ai/sdk';
import type { LlmProvider, LlmRequest, LlmResponse } from './llm-provider.js';

// The real LLM provider — the first real model in the system, behind the UNCHANGED
// `complete({system?, prompt}) -> {text}` seam. It is a SECOND implementation
// alongside FakeLlmProvider; the seam signature does not change, and the seam stays
// domain-agnostic (prompt in, text out — it knows nothing of units or findings).
//
// Selection is env-driven and lives OUTSIDE buildContainer (see select-llm-provider.ts
// and the eval harness): buildContainer stays pure (the fake by default), so the whole
// test suite runs green with no key and no network. No test constructs this against the
// real API — the injectable client below lets tests drive the response->text mapping
// deterministically.

/**
 * The model the lenses run on — a single named constant, verified against the Claude
 * API reference at build time: `claude-opus-4-8`, the current default Opus-tier model.
 */
export const ANTHROPIC_MODEL = 'claude-opus-4-8';

/**
 * Output ceiling per call. A lens emits a handful of findings — comfortably within the
 * non-streaming safety band, so a single non-streaming request is fine here.
 */
const MAX_TOKENS = 16000;

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
      // Adaptive thinking: qualitative synthesis benefits from it; `display` defaults
      // to omitted, so thinking blocks carry no text and we read only the text blocks.
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: request.prompt }],
      ...(request.system !== undefined ? { system: request.system } : {}),
    });

    // A safety refusal is "the model declined", NOT a transport failure: map it to
    // empty text so the lens's tolerant parse yields no findings — the silence side of
    // the boundary. Transport/API errors are deliberately NOT caught here; they
    // propagate as exceptions per the seam convention (and the SDK already retries
    // 429 / 5xx / network errors before throwing).
    if (message.stop_reason === 'refusal') {
      return { text: '' };
    }

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    return { text };
  }
}
