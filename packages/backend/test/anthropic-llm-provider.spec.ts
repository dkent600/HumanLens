import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import {
  ANTHROPIC_MODEL,
  AnthropicLlmProvider,
  type AnthropicMessagesClient,
} from '../src/seams/anthropic-llm-provider.js';

// The real provider's only logic is the request shape and the response mapping (text +
// finish signal); the network is the SDK's job. So we inject a stub client and assert
// that mapping deterministically — NO test makes a real API call (the default
// `new Anthropic()` is never constructed because every test supplies a stub).

function stub(content: unknown[], stopReason: string | null) {
  const create = vi.fn(
    async (_body: Anthropic.MessageCreateParamsNonStreaming) =>
      ({ content, stop_reason: stopReason }) as unknown as Anthropic.Message,
  );
  return { create, client: { messages: { create } } as AnthropicMessagesClient };
}

describe('AnthropicLlmProvider — request shape and response mapping (text + stopReason)', () => {
  it('concatenates text blocks, ignores thinking blocks, and surfaces the stop reason', async () => {
    const { client } = stub(
      [
        { type: 'thinking', thinking: '' },
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'world' },
      ],
      'end_turn',
    );
    const response = await new AnthropicLlmProvider(client).complete({ prompt: 'p' });
    expect(response.text).toBe('Hello world');
    expect(response.stopReason).toBe('end_turn');
  });

  it('passes a refusal THROUGH — stopReason "refusal", text unmodified (the fake-empty-drop fix)', async () => {
    // The prior mapping collapsed a refusal to {text:''} — indistinguishable from a
    // chosen empty, so it was recorded answered-empty and never retried: the fake-empty
    // drop. This test is the regression guard on the reversal: the refusal signal
    // survives the seam so the caller can route it delivered-but-unusable.
    const { client } = stub([{ type: 'text', text: 'I can not help with that.' }], 'refusal');
    const response = await new AnthropicLlmProvider(client).complete({ prompt: 'p' });
    expect(response.stopReason).toBe('refusal');
    expect(response.text).toBe('I can not help with that.'); // no laundering to ''
  });

  it('surfaces max_tokens (truncation) so the caller can route it unusable', async () => {
    const { client } = stub([{ type: 'text', text: '{"findings":[{"noti' }], 'max_tokens');
    const response = await new AnthropicLlmProvider(client).complete({ prompt: 'p' });
    expect(response.stopReason).toBe('max_tokens');
  });

  it('throws on a null stop_reason (SDK anomaly — an uncertified finish is never routed as natural)', async () => {
    const { client } = stub([{ type: 'text', text: 'x' }], null);
    await expect(new AnthropicLlmProvider(client).complete({ prompt: 'p' })).rejects.toThrow(
      /stop_reason/,
    );
  });

  it('sends the model id, adaptive thinking, the system prompt, and the prompt', async () => {
    const { create, client } = stub([{ type: 'text', text: 'x' }], 'end_turn');
    await new AnthropicLlmProvider(client).complete({ system: 'SYS', prompt: 'PR' });

    const body = create.mock.calls[0][0];
    expect(body.model).toBe(ANTHROPIC_MODEL);
    expect(body.system).toBe('SYS');
    expect(body.messages).toEqual([{ role: 'user', content: 'PR' }]);
    expect(body.thinking).toEqual({ type: 'adaptive' });
    expect(body.max_tokens).toBeGreaterThan(0);
  });

  it('omits the system field when no system prompt is given', async () => {
    const { create, client } = stub([{ type: 'text', text: 'x' }], 'end_turn');
    await new AnthropicLlmProvider(client).complete({ prompt: 'PR' });

    expect(create.mock.calls[0][0].system).toBeUndefined();
  });
});
