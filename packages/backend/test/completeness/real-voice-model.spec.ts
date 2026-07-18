import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import {
  ANTHROPIC_MODEL,
  AnthropicLlmProvider,
  type AnthropicMessagesClient,
} from '../../src/seams/anthropic-llm-provider.js';
import { routeLlmResponse } from '../../src/seams/llm-provider.js';
import {
  AnthropicVoiceModel,
  finishReasonOf,
} from '../../src/eval/completeness/real/anthropic-voice-model.js';
import { contrastPaths } from '../../src/eval/completeness/real/two-path-contrast.js';
import { observeVoiceCall } from '../../src/eval/completeness/voice-call-adapter.js';
import { TransportError } from '../../src/eval/completeness/model-call.js';

// Offline verification of the REAL-model path logic — everything except the network call.
// A stub AnthropicMessagesClient (the same injection seam the production provider uses)
// drives the response->outcome mapping deterministically, so no test spends money. What
// these DON'T cover — whether the real model actually truncates, real cache rates, real
// timing — is exactly what Doug's F1/F2/F3 runs measure.

/** Build a minimal Anthropic.Message stub with the given text and stop_reason. */
function makeMessage(text: string, stopReason: Anthropic.StopReason): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: ANTHROPIC_MODEL,
    content: text === '' ? [] : [{ type: 'text', text, citations: null }],
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: 100,
      output_tokens: 5,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
  } as unknown as Anthropic.Message;
}

function stubReturning(message: Anthropic.Message): AnthropicMessagesClient {
  return { messages: { create: () => Promise.resolve(message) } };
}

describe('finishReasonOf — Anthropic stop_reason passes through (vocabulary aligned)', () => {
  it('passes the raw stop_reason through unchanged (the eval FinishReason IS the seam vocabulary)', () => {
    for (const r of ['end_turn', 'stop_sequence', 'max_tokens', 'refusal', 'tool_use', 'pause_turn'] as const) {
      expect(finishReasonOf(r)).toBe(r);
    }
  });

  it('throws on a null stop_reason (an uncertifiable finish is never routed as natural)', () => {
    expect(() => finishReasonOf(null)).toThrow(/stop_reason/);
  });
});

describe('AnthropicVoiceModel — response/error mapping (stubbed client, no network)', () => {
  const voices = [{ voiceId: 'eval-u1', content: 'a voice' }];

  it('surfaces stop_reason + text as a responded outcome, and reports usage', async () => {
    const onUsage = vi.fn();
    const body = JSON.stringify({ findings: [{ noticing: 'a meaning', sourceFindingId: 'eval-u1' }] });
    const model = new AnthropicVoiceModel(voices, stubReturning(makeMessage(body, 'end_turn')), { onUsage });

    const outcome = await model.call('run', 'eval-u1', 0);
    expect(outcome).toEqual({ kind: 'responded', finishReason: 'end_turn', body });
    expect(onUsage).toHaveBeenCalledOnce();

    // And it flows through the total adapter to answered-with-findings.
    const obs = await observeVoiceCall('eval-u1', new Set(['eval-u1']), () => model.call('run', 'eval-u1', 0));
    expect(obs.state).toBe('answered-with-findings');
  });

  it('maps a provider HTTP status to an http-error outcome (A7 path)', async () => {
    const client: AnthropicMessagesClient = {
      messages: { create: () => Promise.reject(Object.assign(new Error('rate limited'), { status: 429 })) },
    };
    const model = new AnthropicVoiceModel(voices, client);
    const outcome = await model.call('run', 'eval-u1', 0);
    expect(outcome).toEqual({ kind: 'http-error', status: 429 });
  });

  it('maps a network failure (no status) to a TransportError the adapter routes to failed', async () => {
    const client: AnthropicMessagesClient = {
      messages: { create: () => Promise.reject(new Error('socket hang up')) },
    };
    const model = new AnthropicVoiceModel(voices, client);
    await expect(model.call('run', 'eval-u1', 0)).rejects.toBeInstanceOf(TransportError);

    const obs = await observeVoiceCall('eval-u1', new Set(['eval-u1']), () => model.call('run', 'eval-u1', 0));
    expect(obs.state).toBe('failed');
    expect(obs.reasonCode).toBe('transport');
  });
});

describe('F1-b ★ — the two-path divergence, NARROWED by the real run', () => {
  // The real F1-b run (claude-opus-4-8, max_tokens 16 then 8) NARROWED ★: max_tokens
  // truncation is SELF-MITIGATING — it yields a PARTIAL, unparseable body, which the parse-
  // exception guard already catches, so BOTH paths route to delivered-but-unusable (no
  // divergence). The residual, still-unproven ★ is a clean-empty body on a NON-natural finish.
  // Anthropic has no `content_filter` stop_reason (its set is end_turn/max_tokens/stop_sequence/
  // tool_use/pause_turn/refusal), so the Anthropic-NATIVE concrete instance is REFUSAL: the
  // production seam's `stop_reason==='refusal' -> {text:''}` line collapses a refusal to empty
  // text with no signal, so it reads as chosen-empty. These two tests pin BOTH the self-
  // mitigation AND the residual delta. (Refusal-as-residual-★ surfaced to Doug, not just encoded.)

  it('max_tokens truncation self-mitigates: a partial unparseable body → both paths unusable (NO divergence)', async () => {
    const partial = makeMessage('{"findings":[{"noticing":"the team has be', 'max_tokens');
    const result = await contrastPaths(partial, 'eval-u24', new Set(['eval-u24']));
    // Production seam assumes natural, but the partial body won't parse → parse-exception → unusable.
    expect(result.path1ProductionSeam.state).toBe('delivered-but-unusable');
    // Total adapter sees max_tokens → truncated → unusable. Same landing: no silent drop.
    expect(result.path2TotalAdapter.state).toBe('delivered-but-unusable');
  });

  it('the residual ★ is CLOSED: the seam now surfaces a refusal instead of laundering it to empty', async () => {
    const refused = makeMessage('', 'refusal');

    // The fake-empty-drop seam fix: the production seam no longer collapses a refusal to
    // {text:''}. The finish signal survives the seam, and the seam-boundary routing sends
    // it to delivered-but-unusable — a refusal can never again masquerade as chosen-empty.
    const production = new AnthropicLlmProvider(stubReturning(refused));
    const response = await production.complete({ prompt: 'p' });
    expect(response.stopReason).toBe('refusal');
    expect(routeLlmResponse(response)).toEqual({ kind: 'unusable', reason: 'refused' });

    // contrastPaths' PATH 1 models a consumer that IGNORES the surfaced signal — the
    // pre-fix world, kept as the historical record of the drop. The delta against PATH 2
    // (which reads the signal) is what ★ WAS; the fix moves every production consumer
    // onto the PATH-2 read.
    const result = await contrastPaths(refused, 'eval-u24', new Set(['eval-u24']));
    expect(result.path1ProductionSeam.state).toBe('answered-empty'); // the old, signal-blind read
    expect(result.path2TotalAdapter.state).toBe('delivered-but-unusable'); // the signal-aware read
    expect(result.path2TotalAdapter.reasonCode).toBe('refusal');
  });
});
