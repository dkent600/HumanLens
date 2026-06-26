import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import {
  ANTHROPIC_MODEL,
  AnthropicLlmProvider,
  type AnthropicMessagesClient,
} from '../src/seams/anthropic-llm-provider.js';

// The real provider's only logic is the request shape and the response->text mapping;
// the network is the SDK's job. So we inject a stub client and assert that mapping
// deterministically — NO test makes a real API call (the default `new Anthropic()` is
// never constructed because every test supplies a stub).

function stub(content: unknown[], stopReason: string) {
  const create = vi.fn(
    async () => ({ content, stop_reason: stopReason }) as unknown as Anthropic.Message,
  );
  return { create, client: { messages: { create } } as AnthropicMessagesClient };
}

describe('AnthropicLlmProvider — request shape and response->text mapping', () => {
  it('concatenates text blocks and ignores thinking blocks', async () => {
    const { client } = stub(
      [
        { type: 'thinking', thinking: '' },
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'world' },
      ],
      'end_turn',
    );
    const { text } = await new AnthropicLlmProvider(client).complete({ prompt: 'p' });
    expect(text).toBe('Hello world');
  });

  it('maps a refusal to empty text (silence, not an exception)', async () => {
    // Even if the refused message carries text, a refusal yields empty -> no findings.
    const { client } = stub([{ type: 'text', text: 'should be ignored' }], 'refusal');
    const { text } = await new AnthropicLlmProvider(client).complete({ prompt: 'p' });
    expect(text).toBe('');
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
