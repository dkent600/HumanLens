import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_MODEL, type AnthropicMessagesClient } from '../../../seams/anthropic-llm-provider.js';
import { TransportError, type FinishReason, type RawSdkOutcome, type VoiceModel } from '../model-call.js';

// The REAL per-voice model bridge (eval-tier) — the VoiceModel the fan-out drives against
// the actual claude-opus-4-8 for the F1/F2/F3 falsifiers. It is a SEPARATE, eval-only
// adapter; it does NOT modify the production `AnthropicLlmProvider`.
//
// HISTORICAL NOTE (the fix landed): this bridge originally existed because the production
// seam discarded `stop_reason` (the ★ finding). The fake-empty-drop seam fix has since
// landed — the production seam now surfaces `stopReason` itself. The bridge remains for
// what the production seam still does NOT carry: per-call token `usage` (F2), in-band
// HTTP-status mapping, and the V-1 adapter's FinishReason vocabulary. Folding it onto the
// production seam is carried forward to the orchestrator task.

/** A voice to send: its id (the provenance anchor) and its de-identified content. */
export interface VoiceContent {
  readonly voiceId: string;
  readonly content: string;
}

export interface AnthropicVoiceModelOptions {
  /** Output ceiling. Low values force `stop_reason: 'max_tokens'` (truncation) — used by F1-b. */
  readonly maxTokens?: number;
  /** Omit extended thinking so a low `maxTokens` truncates the FINDINGS text, not the thinking. */
  readonly disableThinking?: boolean;
  /** Mark the shared system prompt cacheable (prompt caching) — used by F2. */
  readonly cacheSystemPrompt?: boolean;
  /** Per-call usage sink for F2 cache instrumentation. */
  readonly onUsage?: (usage: Anthropic.Usage) => void;
}

/**
 * Map the Anthropic `stop_reason` to the adapter's FinishReason. NATURAL = end_turn /
 * stop_sequence; `max_tokens` (truncation) → 'length'; `refusal` → 'refusal'. Anything else
 * (`tool_use`, `pause_turn`, null) is not expected for a single-shot text lens call and is
 * routed as a NON-natural finish (mapped to 'content_filter') so the total adapter treats
 * it as unusable rather than mistaking it for a natural answer.
 */
export function mapStopReason(stopReason: Anthropic.StopReason | null): FinishReason {
  switch (stopReason) {
    case 'end_turn':
      return 'end_turn';
    case 'stop_sequence':
      return 'stop';
    case 'max_tokens':
      return 'length';
    case 'refusal':
      return 'refusal';
    default:
      return 'content_filter';
  }
}

/** The compact per-voice Human Meaning system contract (single voice per call). */
export const PER_VOICE_SYSTEM = [
  'You are one lens in a qualitative-synthesis pipeline for a human-centered consulting team.',
  'Your stance is that of an observer and pattern-noticer, never an authority. You do not',
  'diagnose individuals, label people, psychoanalyze, or overstate.',
  '',
  'This is the Human Meaning Lens, run for a SINGLE voice. Its question is: what might this',
  'one comment mean at the human level? Notice what it may reveal about unmet needs, fears,',
  'hopes, identity concerns, belonging or trust signals, dignity concerns, or moments of pain',
  'or aspiration. Stay close to what the voice could plausibly mean; where you would have to',
  'guess from context the words do not carry, say less.',
  '',
  'You are given one voice as JSON: its `voiceId` and its `content`. Return ONLY a JSON object',
  'of exactly this shape, no prose, no markdown fence:',
  '{"findings":[{"noticing":"...","sourceFindingId":"<the given voiceId>"}]}',
  'Each finding MUST set `sourceFindingId` to the given voiceId exactly. You MAY return more',
  'than one finding when the voice carries more than one human meaning. If the meaning cannot',
  'be grounded in the words themselves, return one finding whose noticing names it as an answer',
  'best understood in context, worth exploring — do not invent a meaning.',
].join('\n');

/** The user prompt: the one voice as JSON. */
export function buildUserPrompt(voiceId: string, content: string): string {
  return JSON.stringify({ voiceId, content });
}

export class AnthropicVoiceModel implements VoiceModel {
  private readonly byId: Map<string, string>;

  constructor(
    voices: readonly VoiceContent[],
    // The default client reads ANTHROPIC_API_KEY from the environment; a test injects a stub
    // so no unit test makes a real network call (mirrors AnthropicLlmProvider).
    private readonly client: AnthropicMessagesClient = new Anthropic(),
    private readonly options: AnthropicVoiceModelOptions = {},
  ) {
    this.byId = new Map(voices.map((v) => [v.voiceId, v.content]));
  }

  async call(_runId: string, voiceId: string, _attempt: number): Promise<RawSdkOutcome> {
    const content = this.byId.get(voiceId);
    if (content === undefined) {
      throw new Error(`AnthropicVoiceModel: unknown voice ${voiceId}`);
    }

    const body: Anthropic.MessageCreateParamsNonStreaming = {
      model: ANTHROPIC_MODEL,
      max_tokens: this.options.maxTokens ?? 4000,
      system: this.buildSystem(),
      messages: [{ role: 'user', content: buildUserPrompt(voiceId, content) }],
      ...(this.options.disableThinking ? {} : { thinking: { type: 'adaptive' } }),
    };

    let message: Anthropic.Message;
    try {
      message = await this.client.messages.create(body);
    } catch (err) {
      // A provider HTTP status → an http-error outcome the adapter routes (A7). A network
      // failure/timeout (no status) → TransportError → failed(transport). The SDK already
      // retries 429/5xx/network before throwing.
      const status = (err as { status?: number }).status;
      if (typeof status === 'number') {
        return { kind: 'http-error', status };
      }
      throw new TransportError(err instanceof Error ? err.message : String(err));
    }

    this.options.onUsage?.(message.usage);

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    return { kind: 'responded', finishReason: mapStopReason(message.stop_reason), body: text };
  }

  /** The system prompt, optionally marked cacheable (a single ephemeral cache breakpoint). */
  private buildSystem(): string | Anthropic.TextBlockParam[] {
    if (!this.options.cacheSystemPrompt) {
      return PER_VOICE_SYSTEM;
    }
    return [{ type: 'text', text: PER_VOICE_SYSTEM, cache_control: { type: 'ephemeral' } }];
  }
}
