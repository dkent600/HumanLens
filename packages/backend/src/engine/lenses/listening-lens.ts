import type { Unit } from '../../domain/types.js';
import type { Finding } from '../../domain/finding.js';
import { makeOrdinaryFinding } from '../../domain/finding.js';
import type {
  LensPromptPayload,
  LensResponseCandidate,
  LlmProvider,
} from '../../seams/llm-provider.js';
import type { Wave, Lens } from './lens.js';
import { runPerVoiceLens, type PerVoiceLens } from '../completeness/per-voice-lens.js';
import type { ParsedVoiceBody, VoiceOperation } from '../completeness/voice-orchestrator.js';
import type { QuarantinedFinding } from '../completeness/terminal-state.js';

// The Listening Lens — the first Evidence-wave lens: "what are people actually saying?"
// (repeated themes, direct concerns, representative quotes). It reads the cleared units and
// is the first lens with a real model behind it.
//
// PER-VOICE FAN-OUT (build_implementation.md, "Completeness — orchestration"). Listening is
// a per-voice lens: a VOICE is one unit, and it runs through the production orchestrator —
// ONE model call per unit, keyed by unit id, four-state ledger, retry/termination. The lens
// no longer calls the model or gates the finish signal itself; it supplies a VoiceOperation
// (its prompt, its tolerant parse, its finding shape, its provenance check, its completeness
// invariant) and the orchestrator does the rest. The prompt and finding shape are UNCHANGED
// — only the call granularity moved from one batched call to one call per voice.
//
// PROVENANCE (P3, owned by the parse): each call sends exactly ONE unit, so the only
// legitimate anchor is that unit. A candidate citing a DIFFERENT valid unit (cross-voice) or
// an id never sent (hallucinated) is quarantined, never attributed — the anchoring guard,
// now per-voice.
//
// COMPLETENESS INVARIANT (declared, enforced by the orchestrator): every AUTHORED voice must
// yield >=1 finding; only non-authored (empty/whitespace) emptiness may resolve answered-empty
// (build_approach.md, "Surface every voice"). An authored voice that comes back empty is
// recorded as an invariant VIOLATION alongside the truthful answered-empty state — never
// retried (P7), never rerouted.
//
// SILENCE VS EXCEPTION is now the orchestrator's four-state accounting: a malformed/prose
// body on a natural finish is delivered-but-unusable (not a silent empty); a non-natural
// finish (refusal/truncation) is delivered-but-unusable; a transport failure is failed.
// Findings-level behavior is unchanged: a bad body yields no fabricated finding.

const INSTRUCTION =
  'Surface what people are actually saying. Return findings; each must cite the unit ids that support it.';

// The versioned system contract — the half a real model reads. UNCHANGED by this task. It is
// written for "a list of units"; a per-voice call simply passes a one-element list.
const SYSTEM = [
  'You are one lens in a qualitative-synthesis pipeline for a human-centered consulting team.',
  'Your stance is that of an observer and pattern-noticer, never an authority: you surface what',
  'is present in the material so that a human can decide what it means. You do not diagnose',
  'individuals, label people, or overstate.',
  '',
  'This is the Listening Lens. Its question is: what are people actually saying? Stay close to',
  'the source. Surface the concerns, hopes, frustrations, and emotional tones expressed in the',
  'material, as they are expressed.',
  '',
  'Stay low. Notice; do not conclude. Specifically:',
  '- Do NOT synthesize across voices, construct unified themes, or interpret what separate',
  '  statements mean together — later lenses do that work.',
  '- Do NOT name an abstraction that unites statements (for example, "a gap between stated',
  '  intentions and lived experience"). Report the statements themselves, in their own terms.',
  '- Each finding surfaces what a single voice said, and cites that voice\'s unit. Do not',
  '  produce one finding spanning several units. When the same concern appears in more than',
  '  one unit, surface each unit\'s voice separately — noticing that a concern recurs across',
  '  voices is a later lens\'s job, not this one\'s.',
  '',
  'Preserve the structure the speaker gave. If a voice draws a relation — a cause, a contrast,',
  'a condition, a contingency — carry it at the strength they gave it. Do not split what the',
  'speaker bound together; do not bind together what they did not. Real comments signal these',
  'relations softly far more often than with the word "because": a dash, "just", "still", bare',
  'adjacency, or plain narrative sequence. Surface a soft or implied link as softly as it was',
  'given; never upgrade an implied relation into an asserted causal claim. When in doubt, stay',
  'with the voice.',
  '',
  'Carry only the context the speaker themselves supplied. Never add surrounding context, a',
  'likely cause, or what a statement "really means" given everything else — however reasonable',
  'the inference. A convincing guess reads exactly like evidence on the page, which is precisely',
  'why it is prohibited here; context that is declared rather than guessed enters later,',
  'downstream.',
  '',
  'Emit each finding as the speaker\'s own words, verbatim, in the "verbatim" field — the exact',
  'span as given: original language, punctuation, run-ons, fragments, casing, and first person,',
  'all untouched. Never paraphrase, normalize, repair, tidy, or de-personalize. Messy form can',
  'itself be signal, and repairing it (e.g. adding a connective the speaker did not write)',
  'inserts structure the voice did not supply. For a split (one unit, two unrelated things),',
  '"verbatim" is the span you are surfacing, not necessarily the whole unit.',
  '',
  'When a unit is not in usable English, still carry the original words in "verbatim", and ALSO',
  'provide "translation" — a literal first-person English rendering of those same words (same',
  'structure and register; nothing added, smoothed, de-personalized, or interpreted) — and',
  '"sourceLanguage", the name of the original language (e.g. "Spanish"). For a mixed-language',
  'unit, "verbatim" is the mixed original as-is, "translation" renders the whole of it to',
  'English, and "sourceLanguage" names the non-English language present. Omit "translation" and',
  '"sourceLanguage" entirely for an English unit. The language boundary is shown by these',
  'fields, not by any inline note in the text.',
  '',
  'You are given a JSON object with a list of de-identified units, each with a unitId and its',
  'content. Rules:',
  '- Every finding MUST cite, in evidenceUnitIds, the unitId(s) whose content supports it.',
  '- Use ONLY unitIds present in the input; never invent one. A finding with no supporting',
  '  unitId is not allowed — omit it.',
  '- Surface a voice whenever the person AUTHORED an utterance — however thin, terse, hedged, or',
  '  opaque its meaning. ANY authored token surfaces, its verbatim intact, as the fact that it was',
  '  said: a bare "No comment", "n/a", "IDK", or even a lone ".". (A unit whose meaning depends on',
  '  context you don\'t have is surfaced as the fact that it was said, never with a guess at what it',
  '  meant.) Do NOT classify what such a token means — whether it declines, expresses uncertainty,',
  '  or is thin-but-real is a later lens\'s job, not this one\'s.',
  '- Return NO finding for a unit ONLY when it is genuinely contentless — non-authored structural',
  '  emptiness: empty, only whitespace, or form scaffolding the person did not write. An authored',
  '  token is never "too little material".',
  '',
  'Return ONLY a JSON object of exactly this shape, with no surrounding prose, explanation, or',
  'markdown fences. For an English unit include only "verbatim" and "evidenceUnitIds"; for a',
  'non-English unit also include "translation" and "sourceLanguage":',
  '{"findings":[{"verbatim":"...","translation":"...","sourceLanguage":"...","evidenceUnitIds":["..."]}]}',
].join('\n');

export class ListeningLens implements Lens, PerVoiceLens<Finding> {
  readonly id = 'listening';
  readonly wave: Wave = 'evidence';

  /** A voice is one unit. */
  voiceIds(units: readonly Unit[]): readonly string[] {
    return units.map((u) => u.unitId);
  }

  operation(units: readonly Unit[], _priorFindings: readonly Finding[], provider: LlmProvider): VoiceOperation<Finding> {
    const unitById = new Map(units.map((u) => [u.unitId, u]));
    const voiceIndexById = new Map(units.map((u, i) => [u.unitId, i]));
    const knownVoiceIds = new Set(units.map((u) => u.unitId));

    return {
      call: (voiceId) => {
        const unit = unitById.get(voiceId);
        if (unit === undefined) throw new Error(`ListeningLens: unknown voice ${voiceId}`);
        // One unit per call — the prompt's "list of units" is a one-element list here.
        const payload: LensPromptPayload = {
          instruction: INSTRUCTION,
          units: [{ unitId: unit.unitId, speakerToken: unit.speakerToken, content: unit.content }],
        };
        return provider.complete({ system: SYSTEM, prompt: JSON.stringify(payload) });
      },
      parse: (text, voiceId) =>
        parseVoice(text, voiceId, this.id, voiceIndexById.get(voiceId) ?? 0, knownVoiceIds, units),
      answeredEmptyLegitimate: (voiceId) => {
        const unit = unitById.get(voiceId);
        // Legitimate ONLY for a genuinely non-authored unit (empty/whitespace). An authored
        // voice must yield >=1 finding — an empty result there is a completeness violation.
        return unit === undefined ? true : unit.content.trim() === '';
      },
    };
  }

  // The Lens-interface entry: fan out through the orchestrator with an ephemeral in-memory
  // ledger (the fake/test path; records produced but not persisted) and return the findings.
  // The eval / real path calls `runPerVoiceLens` directly with a durable ledger to inspect
  // the (run_id, voice_id) records and invariant violations.
  async run(
    units: readonly Unit[],
    _priorFindings: readonly Finding[],
    provider: LlmProvider,
  ): Promise<readonly Finding[]> {
    const { findings } = await runPerVoiceLens(this, units, [], provider);
    return findings;
  }
}

/**
 * Parse ONE voice's response into Listening findings anchored to that voice's unit.
 *   - A malformed / non-envelope body → `{ usable: false }` (delivered-but-unusable, P4).
 *   - A well-formed body → attribute each candidate that cites THIS unit; a candidate citing a
 *     different valid unit (cross-voice) or an unknown id is quarantined, never attributed (P3).
 *   - A well-formed body with no attributable finding and nothing quarantined → usable empty
 *     (the orchestrator resolves answered-empty; the lens's invariant declaration decides
 *     whether that is legitimate for this voice).
 */
function parseVoice(
  text: string,
  unitId: string,
  lensId: string,
  voiceIndex: number,
  knownVoiceIds: ReadonlySet<string>,
  units: readonly Unit[],
): ParsedVoiceBody<Finding> {
  const envelope = parseEnvelope(text);
  if (!envelope.ok) {
    return { usable: false };
  }

  const attributed: Finding[] = [];
  const quarantined: QuarantinedFinding[] = [];
  for (const candidate of envelope.candidates) {
    const anchorsThisVoice = candidate.evidenceUnitIds.includes(unitId);
    if (anchorsThisVoice && candidate.verbatim !== undefined) {
      attributed.push(
        makeOrdinaryFinding({
          findingId: `${lensId}:${voiceIndex}-${attributed.length}`,
          lens: 'listening',
          verbatim: candidate.verbatim,
          ...(candidate.translation !== undefined
            ? { translation: candidate.translation, sourceLanguage: candidate.sourceLanguage }
            : {}),
          evidenceLinks: [unitId],
          units,
        }),
      );
    } else {
      // Not attributable to this voice — record the misattribution claim (P3), never attribute it.
      const claimed = candidate.evidenceUnitIds.find((id) => id !== unitId);
      if (claimed !== undefined) {
        quarantined.push({
          claimedVoiceId: claimed,
          reason: knownVoiceIds.has(claimed) ? 'foreign-voice' : 'unknown-voice',
        });
      }
      // A candidate with no anchor at all is simply dropped (no claim to record).
    }
  }
  return { usable: true, findings: attributed, quarantined };
}

type Envelope =
  | { readonly ok: false }
  | { readonly ok: true; readonly candidates: readonly LensResponseCandidate[] };

/**
 * Tolerant parse of the model's text into the lens-response envelope. Distinguishes a
 * well-formed (possibly EMPTY) findings envelope from a malformed body: an empty string, a
 * ```json fence, or a well-formed `{"findings":[...]}` parse to `ok:true`; prose, non-object
 * JSON, or a missing `findings` array parse to `ok:false` (delivered-but-unusable). Field
 * validation of each candidate is unchanged from the prior batched parse.
 */
function parseEnvelope(text: string): Envelope {
  const body = stripFence(text.trim());
  if (body === '') {
    return { ok: true, candidates: [] }; // a usable empty response (chosen silence)
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false };
  }
  const findings = (parsed as { findings?: unknown }).findings;
  if (!Array.isArray(findings)) {
    return { ok: false };
  }
  const candidates: LensResponseCandidate[] = [];
  for (const raw of findings) {
    if (typeof raw !== 'object' || raw === null) continue;
    const verbatim = (raw as { verbatim?: unknown }).verbatim;
    const translation = (raw as { translation?: unknown }).translation;
    const sourceLanguage = (raw as { sourceLanguage?: unknown }).sourceLanguage;
    const ids = (raw as { evidenceUnitIds?: unknown }).evidenceUnitIds;
    if (typeof verbatim !== 'string' || verbatim.trim() === '') continue;
    if (!Array.isArray(ids) || !ids.every((id): id is string => typeof id === 'string')) continue;
    if (
      typeof translation === 'string' &&
      translation.trim() !== '' &&
      typeof sourceLanguage === 'string' &&
      sourceLanguage.trim() !== ''
    ) {
      candidates.push({ verbatim, translation, sourceLanguage, evidenceUnitIds: ids });
    } else {
      candidates.push({ verbatim, evidenceUnitIds: ids });
    }
  }
  return { ok: true, candidates };
}

/** Strip a single ```json ... ``` (or bare ``` ... ```) fence if the model wrapped its JSON in one. */
function stripFence(text: string): string {
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  return fence ? fence[1].trim() : text;
}
