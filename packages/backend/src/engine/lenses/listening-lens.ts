import type { Unit } from '../../domain/types.js';
import type { Finding } from '../../domain/finding.js';
import { makeOrdinaryFinding } from '../../domain/finding.js';
import type {
  LensPromptPayload,
  LensResponseCandidate,
  LlmProvider,
} from '../../seams/llm-provider.js';
import type { Wave, Lens } from './lens.js';

// The Listening Lens — the first Evidence-wave lens: "what are people actually
// saying?" (repeated themes, direct concerns, representative quotes). It reads
// the cleared units directly, and is the FIRST lens with a real model behind it.
//
// The prompt-and-parse contract is split to honor the unchanged provider seam
// (`complete({system?, prompt}) -> {text}`):
//   - the `system` prompt (SYSTEM below) carries the lens's versioned contract: its
//     posture, its task, the evidence rule, and the exact JSON output shape the model
//     must return. It is the half a real model needs and the deterministic fake
//     ignores (the fake reads only `prompt`), so the same call drives both.
//   - the `prompt` carries the units as JSON (the shared lens-prompt convention),
//     UNCHANGED, so the fake is unaffected.
// The response is parsed TOLERANTLY (parseCandidates): a model that returns bad JSON,
// a fenced block, prose, or wrong-typed fields yields no findings rather than a crash
// — "model misbehaved -> silence", the safe failure mode. (A transport failure is a
// different thing: it propagates as an exception from the provider, never disguised as
// silence.) Whatever survives the parse then goes through the SAME anchoring guard as
// before: an id the model invented but that is not in this run's cleared set is dropped
// — the net against a hallucinated anchor, on the real path as on the fake.
//
// Disposition is left at its default (HELD): an Evidence-wave lens does not
// promote findings to the client-safe layer. That is an affirmative act for the
// Discernment lens / human review (both deferred). Finding ids are deterministic
// (`listening:0`, ...) to keep the slice reproducible.

const INSTRUCTION =
  'Surface what people are actually saying. Return findings; each must cite the unit ids that support it.';

// The versioned system contract — the half a real model reads. Kept in the lens module
// because each lens is a separately versioned prompt artifact (build_approach.md).
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
  '- Surface a voice whenever the speaker said something — however thin, terse, or',
  '  context-dependent its meaning. (A unit whose meaning depends on context you don\'t have is',
  '  surfaced as the fact that it was said, never with a guess at what it meant.) Return no',
  '  finding for a unit only when it is genuinely contentless — empty, whitespace, or a pure',
  '  form-artifact with no statement behind it.',
  '',
  'Return ONLY a JSON object of exactly this shape, with no surrounding prose, explanation, or',
  'markdown fences. For an English unit include only "verbatim" and "evidenceUnitIds"; for a',
  'non-English unit also include "translation" and "sourceLanguage":',
  '{"findings":[{"verbatim":"...","translation":"...","sourceLanguage":"...","evidenceUnitIds":["..."]}]}',
].join('\n');

export class ListeningLens implements Lens {
  readonly id = 'listening';
  readonly wave: Wave = 'evidence';

  // Evidence wave: reads the cleared units directly, so it ignores `priorFindings`
  // (there are none above it anyway). The uniform signature lets the staged
  // orchestrator treat every lens the same.
  async run(
    units: readonly Unit[],
    _priorFindings: readonly Finding[],
    provider: LlmProvider,
  ): Promise<readonly Finding[]> {
    const payload: LensPromptPayload = {
      instruction: INSTRUCTION,
      units: units.map((u) => ({
        unitId: u.unitId,
        speakerToken: u.speakerToken,
        content: u.content,
      })),
    };

    const response = await provider.complete({ system: SYSTEM, prompt: JSON.stringify(payload) });
    const candidates = parseCandidates(response.text);

    // A lens only ever anchors to the cleared units it was given; ignore any unit
    // id the model returned that is not in scope, so a hallucinated anchor cannot
    // smuggle its way in.
    const inScope = new Set(units.map((u) => u.unitId));

    const findings: Finding[] = [];
    candidates.forEach((candidate, index) => {
      const evidenceLinks = candidate.evidenceUnitIds.filter((id) => inScope.has(id));
      if (evidenceLinks.length === 0) {
        // No valid anchor — an ordinary finding cannot exist without one. The
        // Listening lens deals only in evidence, so it drops it rather than
        // inventing an absence finding.
        return;
      }
      findings.push(
        makeOrdinaryFinding({
          findingId: `${this.id}:${index}`,
          lens: 'listening',
          verbatim: candidate.verbatim,
          ...(candidate.translation !== undefined
            ? { translation: candidate.translation, sourceLanguage: candidate.sourceLanguage }
            : {}),
          evidenceLinks,
          units,
        }),
      );
    });
    return findings;
  }
}

/**
 * Tolerant parse of the model's text into the lens-response convention. Provider output
 * is untrusted: any failure — empty text, a markdown fence, prose, non-object JSON, a
 * missing `findings` array, or a candidate whose fields are the wrong type — yields the
 * candidates that ARE well-formed (often none), never a thrown error. This is the
 * "model misbehaved -> silence" half of the safe failure mode; the anchoring guard in
 * `run` then enforces evidence on whatever survives. (Structural shape only — truth and
 * grounding are not its job: a schema-valid candidate can still cite a hallucinated id,
 * which the anchoring guard catches.)
 *
 * `verbatim` is required; `translation`/`sourceLanguage` are a PAIR — accepted only when
 * both are non-empty strings, and a lone one is ignored (the finding keeps its verbatim).
 * A non-English `verbatim` with no translation is kept, not dropped: a degraded-but-present
 * voice beats a suppressed one, and a missing translation is a model-quality issue the
 * seeded eval is meant to catch — not something to silently swallow a voice over.
 */
function parseCandidates(text: string): readonly LensResponseCandidate[] {
  const body = stripFence(text.trim());
  if (body === '') {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return [];
  }
  const findings = (parsed as { findings?: unknown }).findings;
  if (!Array.isArray(findings)) {
    return [];
  }
  const candidates: LensResponseCandidate[] = [];
  for (const raw of findings) {
    if (typeof raw !== 'object' || raw === null) {
      continue;
    }
    const verbatim = (raw as { verbatim?: unknown }).verbatim;
    const translation = (raw as { translation?: unknown }).translation;
    const sourceLanguage = (raw as { sourceLanguage?: unknown }).sourceLanguage;
    const ids = (raw as { evidenceUnitIds?: unknown }).evidenceUnitIds;
    if (typeof verbatim !== 'string' || verbatim.trim() === '') {
      continue;
    }
    if (!Array.isArray(ids) || !ids.every((id): id is string => typeof id === 'string')) {
      continue;
    }
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
  return candidates;
}

/** Strip a single ```json ... ``` (or bare ``` ... ```) fence if the model wrapped its JSON in one. */
function stripFence(text: string): string {
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  return fence ? fence[1].trim() : text;
}
