import type { Unit } from '../../domain/types.js';
import type { Finding } from '../../domain/finding.js';
import { makeOrdinaryFinding } from '../../domain/finding.js';
import { routeLlmResponse, type LensPromptPayload, type LlmProvider } from '../../seams/llm-provider.js';
import type { Wave, Lens } from './lens.js';
import { toPromptFinding } from './prompt-projection.js';
import {
  collectCitations,
  type CrossVoiceLens,
  type CrossVoiceSynthesis,
} from '../completeness/cross-voice-lens.js';

// The Culture Pattern Lens — the first REAL cross-voice lens (Aggregate wave): "what
// patterns appear across the group or organization?" It is the first lens to read the whole
// finding set at once and emit patterns across it, and the first to exercise the cited-or-
// residual audit on genuine output.
//
// CROSS-VOICE, ONE CALL. Unlike the per-voice lenses (fan-out), Culture Pattern reads the
// complete, closed set of prior-wave findings in ONE call and emits however many patterns
// exist. Its completeness guarantee moves AFTER the call: every pattern cites (in
// `sourceFindingIds`, plural) the findings it is built on; orchestration code subtracts cited
// from delivered and surfaces whatever was never cited as a residual (cross-voice-audit.ts).
//
// ANCHORING is INHERITED from the cited findings' units (the same discipline as Human Meaning,
// but plural): a pattern anchors to the union of the units behind the findings it cites, so it
// stays evidence-anchored without the model emitting unit links. Support is DERIVED from that
// union (distinct speaker tokens), never asserted — no confidence labels, no counts of people.
//
// v1 — ORDINARY FINDINGS ONLY, no absence findings. Comparative outputs (gaps between stated
// values and lived experience; where experience differs across groups) are expressible as
// ordinary findings that CITE BOTH sides they contrast. What is out of scope is a finding
// asserting something was never mentioned with nothing to cite (gated on a separate design
// question). Therefore an ordinary pattern citing ZERO existing findings is a DEFECT — recorded
// and surfaced (uncitedDefects), never emitted, never retried. This is the cross-voice analogue
// of the per-voice invariant violation, and it closes the vacuity risk (a never-citing lens
// would look healthy at 0% coverage while catching nothing).
//
// FUTURE NOTE — "genuinely across voices" is prompt guidance in v1. If it is ever STRUCTURALLY
// enforced, count DISTINCT VOICES (the speaker tokens behind the anchored units), NOT distinct
// findings: Human Meaning emits multiple findings per voice (meaning:2-0, meaning:2-1 both from
// one person), so a pattern citing two findings can be one voice restated — exactly what the
// rule prevents. A findings-count check would NOT be equivalent.

const INSTRUCTION =
  'Surface the culture patterns across the prior findings. Each pattern cites, in sourceFindingIds, the findings it is built on.';

// The versioned system contract. Reads prior findings; cites the findings each pattern draws
// on (plural). It deliberately states NO coverage target and never asks for exhaustive citation
// — a pattern cites what it genuinely uses; the residual honestly holds the rest.
const SYSTEM = [
  'You are one lens in a qualitative-synthesis pipeline for a human-centered consulting team.',
  'Your stance is that of an observer and pattern-noticer, never an authority: you surface what',
  'is present across the material so a human can decide what it means. You do not diagnose',
  'individuals, label people, or overstate.',
  '',
  'This is the Culture Pattern Lens. Its question is: what patterns appear ACROSS the group or',
  'organization? You read a set of prior findings (each the surfaced voice of, or a human-level',
  'noticing about, ONE person), and you notice patterns that run across them:',
  '- recurring dynamics — something that shows up again and again across different voices',
  '- contradictions — voices that pull against each other',
  '- gaps between stated values and lived experience',
  '- repeated leadership or culture signals',
  '- places where experience differs across groups',
  '',
  'This is organizational sensemaking — the across-voices work that the earlier lenses are',
  'forbidden from doing. Rules:',
  '- A pattern must be genuinely ACROSS voices — built on TWO OR MORE distinct VOICES (different',
  '  people). Restating a single voice is not a pattern; if only one voice supports an observation,',
  '  it is not yours to surface. (Note: one voice may carry several prior findings — citing two',
  '  findings from the SAME person is still one voice, not a pattern.) Recurrence and cross-group',
  '  comparison are exactly your job.',
  '- Each pattern MUST name, in `sourceFindingIds`, the `findingId`s of the prior findings it is',
  '  built on — copied exactly from the input. Cite the ones the pattern GENUINELY draws on, and',
  '  only those. Do NOT try to cite everything, and do NOT treat coverage as a goal: a finding',
  '  that no pattern draws on is fine — it simply was not part of a pattern. Citing findings you',
  '  did not actually use would be worse than leaving them uncited.',
  '- For a COMPARATIVE pattern (a gap, or a difference across groups), cite BOTH sides — the',
  '  findings that show one thing AND the findings that show its counterpart. Do not assert that',
  '  something is missing or was never said: you surface only what the findings themselves carry,',
  '  citing them. (An observation you cannot ground in specific findings is not one you make here.)',
  '- Do not add a cause, a story, or context the findings do not carry. Stay with what is there.',
  '- Do not assert how many people or how strong a pattern is; strength is derived from the',
  '  findings behind it, not something you state.',
  '',
  'Emit each pattern in the "noticing" field — your own words describing the pattern across the',
  'voices. Return ONLY a JSON object of exactly this shape, no surrounding prose or markdown fences:',
  '{"findings":[{"noticing":"...","sourceFindingIds":["...","..."]}]}',
].join('\n');

/** One pattern the model returns: the noticing plus the findings it is built on. */
interface PatternCandidate {
  readonly noticing: string;
  readonly sourceFindingIds: readonly string[];
}

export class CulturePatternLens implements Lens, CrossVoiceLens {
  readonly id = 'culture';
  readonly wave: Wave = 'aggregate';

  /** The complete, closed delivered set — the prior-wave findings handed to this lens. */
  deliveredFindingIds(priorFindings: readonly Finding[]): readonly string[] {
    return priorFindings.map((f) => f.findingId);
  }

  /**
   * One call over the whole set. Returns the emitted patterns, the union of the finding ids
   * they cite (for the audit), and any defect (a pattern that cited zero existing findings).
   */
  async synthesize(
    units: readonly Unit[],
    priorFindings: readonly Finding[],
    provider: LlmProvider,
  ): Promise<CrossVoiceSynthesis> {
    // With no prior findings there is nothing to pattern across — stay silent.
    if (priorFindings.length === 0) {
      return { findings: [], cited: [], uncitedDefects: [] };
    }

    const payload: LensPromptPayload = {
      instruction: INSTRUCTION,
      units: units.map((u) => ({ unitId: u.unitId, speakerToken: u.speakerToken, content: u.content })),
      priorFindings: priorFindings.map(toPromptFinding),
    };
    const response = await provider.complete({ system: SYSTEM, prompt: JSON.stringify(payload) });

    // Non-natural finish (refusal / truncation / out-of-protocol) — do not parse. Findings-level
    // silence; the pattern set is simply empty for this call (no ledger on the cross-voice path).
    if (routeLlmResponse(response).kind === 'unusable') {
      return { findings: [], cited: [], uncitedDefects: [] };
    }

    const candidates = parseCandidates(response.text);
    const bySourceId = new Map(priorFindings.map((f) => [f.findingId, f]));
    const inScopeUnits = new Set(units.map((u) => u.unitId));

    const findings: Finding[] = [];
    const emittedCandidates: PatternCandidate[] = [];
    const uncitedDefects: string[] = [];

    for (const candidate of candidates) {
      // Which of the cited ids name findings that ACTUALLY EXIST in the delivered set.
      const validCited = candidate.sourceFindingIds.filter((id) => bySourceId.has(id));
      if (validCited.length === 0) {
        // Cites zero EXISTING findings (empty, or all hallucinated) — a defect. Surface it,
        // do not emit it (it has nothing to ground or anchor to), do not retry. The hallucinated
        // ids are part of the surfaced defect, not separately attributed.
        uncitedDefects.push(candidate.noticing);
        continue;
      }
      // Anchor = the union of the units behind the cited findings (single source of the anchor).
      const anchorUnits = [
        ...new Set(
          validCited.flatMap((id) => [...(bySourceId.get(id)?.evidenceLinks ?? [])]).filter((u) => inScopeUnits.has(u)),
        ),
      ];
      if (anchorUnits.length === 0) {
        // The cited findings carry no in-scope unit — cannot anchor. Treated as the same defect.
        uncitedDefects.push(candidate.noticing);
        continue;
      }
      findings.push(
        makeOrdinaryFinding({
          findingId: `${this.id}:${findings.length}`,
          lens: 'culture',
          noticing: candidate.noticing,
          evidenceLinks: anchorUnits,
          units,
        }),
      );
      emittedCandidates.push(candidate);
    }

    // The audit's cited set is the union of citations across EMITTED patterns (hallucinated ids
    // among them are quarantined by the audit; defect patterns contribute nothing here).
    const cited = collectCitations(
      emittedCandidates.map((c) => ({ noticing: c.noticing, sourceFindingIds: c.sourceFindingIds, evidenceUnitIds: [] })),
    );
    return { findings, cited, uncitedDefects };
  }

  // The Lens-interface entry (the staged pipeline): return just the findings; the audit and the
  // defect are diagnostics surfaced on the eval path (run-lens) via `runCrossVoiceLens`.
  async run(
    units: readonly Unit[],
    priorFindings: readonly Finding[],
    provider: LlmProvider,
  ): Promise<readonly Finding[]> {
    const { findings } = await this.synthesize(units, priorFindings, provider);
    return findings;
  }
}

/**
 * Tolerant parse of the model's text into pattern candidates. Any failure — empty text, a
 * fence, prose, non-object JSON, a missing/mis-typed `findings` or `sourceFindingIds` — yields
 * the well-formed candidates (often none), never a throw. `noticing` must be a non-empty
 * string; `sourceFindingIds` must be an array of strings (possibly empty — an empty one becomes
 * the uncited defect in `synthesize`, not a parse drop).
 */
function parseCandidates(text: string): readonly PatternCandidate[] {
  const body = stripFence(text.trim());
  if (body === '') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }
  if (typeof parsed !== 'object' || parsed === null) return [];
  const findings = (parsed as { findings?: unknown }).findings;
  if (!Array.isArray(findings)) return [];

  const candidates: PatternCandidate[] = [];
  for (const raw of findings) {
    if (typeof raw !== 'object' || raw === null) continue;
    const noticing = (raw as { noticing?: unknown }).noticing;
    const ids = (raw as { sourceFindingIds?: unknown }).sourceFindingIds;
    if (typeof noticing !== 'string' || noticing.trim() === '') continue;
    if (!Array.isArray(ids) || !ids.every((id): id is string => typeof id === 'string')) continue;
    candidates.push({ noticing, sourceFindingIds: ids });
  }
  return candidates;
}

/** Strip a single ```json ... ``` (or bare ``` ... ```) fence if the model wrapped its JSON in one. */
function stripFence(text: string): string {
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  return fence ? fence[1].trim() : text;
}
