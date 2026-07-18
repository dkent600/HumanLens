import fc from 'fast-check';
import type { LlmResponse } from '../../src/seams/llm-provider.js';
import type { ParsedVoiceBody, VoiceOperation } from '../../src/engine/completeness/voice-orchestrator.js';
import type { QuarantinedFinding } from '../../src/engine/completeness/terminal-state.js';

// Test harness for the PRODUCTION orchestrator — a scripted, hostile VoiceOperation that
// is the production analog of the V-1 AdversarialModel, but speaks the REAL seam shape
// (LlmResponse {text, stopReason?}) and a REAL per-voice parse (mirroring the Human
// Meaning lens contract: {findings:[{noticing, sourceFindingId}]}, provenance-checked).
// It exercises behaviors a–l against the production machinery so P1–P9 hold on the real
// path, not just the eval scaffold. (Not a *.spec.ts, so vitest does not run it directly.)

/** The finding shape the scripted parse attributes — voiceId + the model's noticing. */
export interface ProdFinding {
  readonly voiceId: string;
  readonly noticing: string;
}

/** The per-call adversarial behaviors, in the production seam's Anthropic-native terms. */
export type ProdBehavior =
  | 'valid' // a
  | 'empty' // b — chosen silence (natural finish, empty body)
  | 'malformed' // c — unparseable body (corpus)
  | 'refusal' // d — stopReason 'refusal'
  | 'hallucinated' // e — a finding for a voice id never sent
  | 'duplicate' // f — two identical findings for this voice
  | 'cross-voice' // g — a finding for a DIFFERENT valid voice
  | 'transport' // h — a throw with no status (network/timeout)
  | 'truncated' // i — stopReason 'max_tokens', partial body
  | 'out-of-protocol' // k — stopReason 'pause_turn' / 'tool_use', empty body
  | 'provider-rejected' // a throw with a non-retryable 4xx status (A7)
  | 'server-error' // a throw with a 5xx status (retryable transport)
  | 'rate-limited'; // a throw with 429 (retryable transport)

export const PROD_BEHAVIORS: readonly ProdBehavior[] = [
  'valid',
  'empty',
  'malformed',
  'refusal',
  'hallucinated',
  'duplicate',
  'cross-voice',
  'transport',
  'truncated',
  'out-of-protocol',
  'provider-rejected',
  'server-error',
  'rate-limited',
];

/** The behavior-c corpus (unparseable bodies). Kept local; the file stays clean text. */
export const MALFORMED_CORPUS: readonly string[] = [
  '<html><head><title>502</title></head><body>Bad Gateway</body></html>',
  '{"findings":[{"noticing":"the workload has be',
  '� \uD834 garbage ￾',
  'x'.repeat(1_000_000),
];

const HALLUCINATED_ID = 'voice:__hallucinated__';

export interface ProdVoicePlan {
  readonly attempts: readonly ProdBehavior[];
  readonly repeatLast: boolean;
}

export interface ProdRunPlan {
  readonly voiceIds: readonly string[];
  readonly plans: ReadonlyMap<string, ProdVoicePlan>;
}

/** A scripted, self-counting VoiceOperation. `known` is the run's voice set (the operation
 *  carries it — the orchestrator stays lens-agnostic), used to tell foreign (g) from
 *  unknown (e) in the provenance check (P3). */
export class ScriptedVoiceOperation implements VoiceOperation<ProdFinding> {
  private readonly callsByVoice = new Map<string, number>();

  constructor(
    private readonly plan: ProdRunPlan,
    private readonly known: ReadonlySet<string>,
  ) {}

  call(voiceId: string): Promise<LlmResponse> {
    const attempt = this.callsByVoice.get(voiceId) ?? 0;
    this.callsByVoice.set(voiceId, attempt + 1);
    return this.render(this.behaviorFor(voiceId, attempt), voiceId, attempt);
  }

  callCount(voiceId: string): number {
    return this.callsByVoice.get(voiceId) ?? 0;
  }

  /** Tolerant per-voice parse — the production lens contract. Provenance-checks each candidate. */
  parse(text: string, voiceId: string): ParsedVoiceBody<ProdFinding> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripFence(text.trim()));
    } catch {
      return { usable: false };
    }
    if (typeof parsed !== 'object' || parsed === null) return { usable: false };
    const findings = (parsed as { findings?: unknown }).findings;
    if (!Array.isArray(findings)) return { usable: false };

    const attributed: ProdFinding[] = [];
    const quarantined: QuarantinedFinding[] = [];
    const seen = new Set<string>();
    for (const raw of findings) {
      if (typeof raw !== 'object' || raw === null) continue;
      const noticing = (raw as { noticing?: unknown }).noticing;
      const claimed = (raw as { sourceFindingId?: unknown }).sourceFindingId;
      if (typeof noticing !== 'string' || noticing.trim() === '') continue;
      if (typeof claimed !== 'string' || claimed.trim() === '') continue;
      if (claimed === voiceId) {
        if (seen.has(noticing)) continue; // duplicate (f) collapses
        seen.add(noticing);
        attributed.push({ voiceId, noticing });
      } else if (this.known.has(claimed)) {
        quarantined.push({ claimedVoiceId: claimed, reason: 'foreign-voice' }); // g
      } else {
        quarantined.push({ claimedVoiceId: claimed, reason: 'unknown-voice' }); // e
      }
    }
    return { usable: true, findings: attributed, quarantined };
  }

  private behaviorFor(voiceId: string, attempt: number): ProdBehavior {
    const plan = this.plan.plans.get(voiceId);
    if (!plan || plan.attempts.length === 0) return 'valid';
    if (attempt < plan.attempts.length) return plan.attempts[attempt];
    return plan.repeatLast ? plan.attempts[plan.attempts.length - 1] : 'valid';
  }

  private render(behavior: ProdBehavior, voiceId: string, attempt: number): Promise<LlmResponse> {
    switch (behavior) {
      case 'transport':
        return Promise.reject(new Error('socket hang up')); // no status → transport
      case 'provider-rejected':
        return Promise.reject(Object.assign(new Error('forbidden'), { status: 403 }));
      case 'server-error':
        return Promise.reject(Object.assign(new Error('bad gateway'), { status: 503 }));
      case 'rate-limited':
        return Promise.reject(Object.assign(new Error('rate limited'), { status: 429 }));
      case 'malformed':
        return resp('end_turn', pickCorpus(voiceId, attempt));
      case 'refusal':
        return resp('refusal', "I'm not able to help with that.");
      case 'truncated':
        return resp('max_tokens', '{"findings":[{"noticing":"the team has be');
      case 'out-of-protocol':
        return resp(attempt % 2 === 0 ? 'pause_turn' : 'tool_use', '{"findings":[]}');
      case 'empty':
        return resp('end_turn', '{"findings":[]}');
      case 'hallucinated':
        return resp('end_turn', findingsJson([{ sourceFindingId: HALLUCINATED_ID, noticing: 'a meaning' }]));
      case 'duplicate':
        return resp(
          'end_turn',
          findingsJson([
            { sourceFindingId: voiceId, noticing: 'a repeated meaning' },
            { sourceFindingId: voiceId, noticing: 'a repeated meaning' },
          ]),
        );
      case 'cross-voice':
        return resp('end_turn', findingsJson([{ sourceFindingId: this.otherVoiceId(voiceId), noticing: 'wrong voice' }]));
      case 'valid':
        return resp('end_turn', findingsJson([{ sourceFindingId: voiceId, noticing: `meaning for ${voiceId}` }]));
    }
  }

  private otherVoiceId(voiceId: string): string {
    return this.plan.voiceIds.find((id) => id !== voiceId) ?? HALLUCINATED_ID;
  }
}

function resp(stopReason: LlmResponse['stopReason'], text: string): Promise<LlmResponse> {
  return Promise.resolve({ text, stopReason });
}

function findingsJson(findings: readonly { sourceFindingId: string; noticing: string }[]): string {
  return JSON.stringify({ findings });
}

function pickCorpus(voiceId: string, attempt: number): string {
  let hash = attempt;
  for (const ch of voiceId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return MALFORMED_CORPUS[hash % MALFORMED_CORPUS.length];
}

function stripFence(text: string): string {
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  return fence ? fence[1].trim() : text;
}

// ── fast-check arbitraries (seeded, shrinkable) ─────────────────────────────────

export const prodBehaviorArb: fc.Arbitrary<ProdBehavior> = fc.constantFrom(...PROD_BEHAVIORS);

export const prodVoicePlanArb: fc.Arbitrary<ProdVoicePlan> = fc.record({
  attempts: fc.array(prodBehaviorArb, { minLength: 1, maxLength: 5 }),
  repeatLast: fc.boolean(),
});

export const prodRunPlanArb: fc.Arbitrary<ProdRunPlan> = fc
  .array(prodVoicePlanArb, { minLength: 1, maxLength: 20 })
  .map((plans) => {
    const voiceIds = plans.map((_, i) => `voice:${i}`);
    return { voiceIds, plans: new Map(voiceIds.map((id, i) => [id, plans[i]])) };
  });

/** Build a deterministic plan from labelled per-voice scripts (targeted tests). */
export function prodPlanOf(scripts: readonly ProdVoicePlan[]): ProdRunPlan {
  const voiceIds = scripts.map((_, i) => `voice:${i}`);
  return { voiceIds, plans: new Map(voiceIds.map((id, i) => [id, scripts[i]])) };
}
