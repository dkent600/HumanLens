import type { Unit } from '../../domain/types.js';
import type { Finding } from '../../domain/finding.js';
import { makeOrdinaryFinding } from '../../domain/finding.js';
import {
  routeLlmResponse,
  type LensPromptPayload,
  type LlmProvider,
} from '../../seams/llm-provider.js';
import type { Wave, Lens } from './lens.js';
import { toPromptFinding } from './prompt-projection.js';

// The Human Meaning Lens — the single lens of the Meaning wave: "what might these
// comments mean at the human level?" (unmet needs, fears, hopes, identity concerns,
// belonging and trust signals, dignity concerns, moments of pain or aspiration).
//
// EVIDENCE FUNNEL (build_context.md, "Evidence-funnel decision"). Human Meaning does
// NOT read the raw units as interpretive input — only Listening does. It reads the
// PRIOR-wave snapshot, which for the Meaning wave is the Evidence wave = the Listening
// findings. Reading a verbatim Listening finding ≈ reading the unit behind it, so the
// funnel loses ~nothing while keeping one evidentiary base. Units stay in scope only as
// ANCHOR TARGETS (every finding must trace to units), not as input it re-reads.
//
// PER-VOICE, SINGLE-UNIT (granularity locked, build_context.md). It interprets each
// voice — each Listening finding — on its OWN, and does NOT consolidate across voices
// (that is Aggregate's job: Culture Pattern / Tension). A Human Meaning finding is bound
// to exactly ONE voice, and STRUCTURALLY carries exactly ONE unit. The mechanism is that
// the model does NOT emit a unit link at all: per noticing it names the `sourceFindingId`
// of the single prior voice it interprets, and this lens INHERITS that voice's anchoring
// unit. Because one voice = one Listening finding = one unit (build_approach.md), the
// inherited anchor is a single unit; and because the model can only name ONE source per
// noticing, it structurally cannot span voices or consolidate. A model that names a source
// it cannot resolve (unknown/hallucinated id, or a source with no unit) is caught -> the
// noticing is dropped (SILENCE), never slipped through on a trusted-but-wrong unit link.
// It MAY emit MULTIPLE noticings for one voice — e.g. an unmet need AND a fear — each a
// distinct finding (`meaning:0`, `meaning:1`, ...) anchored to that same one unit. This is
// the first lens that emits more than one finding per lens.
//
// MODEL B. Its findings are INTERPRETIVE: each carries a `noticing` (the model's
// interpretation), with `verbatim` null. Same trust boundary as Listening, one wave on: a
// tolerant parse means malformed/bad model output -> SILENCE (no findings, never
// fabricated, never a crash), while a transport failure PROPAGATES from the provider.
//
// CONTEXTUAL ANSWERS (prompt rule, shape unchanged; build_approach.md "The Human Meaning
// Lens" — "Where meaning can't be grounded in the words…"). When a response's potential
// meaning cannot be grounded in the words themselves — any reading would have to be imported
// from context the unit doesn't carry ("n/a", "idk", "No comment", "." are the clear cases, matched by
// that condition, not the string) — the prompt directs the model NOT to supply a meaning,
// not even a hedged one, but to emit a noticing that flags the answer as best understood in
// context, worth exploring, and stop. Any actual exploration is a later lens's job. This is
// still an ordinary noticing (per-voice, single-unit, verbatim null, held) — its CONTENT
// flags-for-exploration rather than interprets; the lens needs no special handling.
//
// Disposition stays HELD: promotion to the client-safe layer is the Discernment lens /
// human review's affirmative act, not a Meaning-wave concern.

const INSTRUCTION =
  'Interpret each prior voice at the human level. Return findings; each must carry a noticing and name, in sourceFindingId, the single prior voice it interprets.';

// The versioned system contract — the half a real model reads. Kept in the lens module
// because each lens is a separately versioned prompt artifact (build_approach.md).
const SYSTEM = [
  'You are one lens in a qualitative-synthesis pipeline for a human-centered consulting team.',
  'Your stance is that of an observer and pattern-noticer, never an authority: you surface what',
  'a voice might mean so that a human can decide. You do not diagnose individuals, label people,',
  'psychoanalyze, or overstate.',
  '',
  'This is the Human Meaning Lens. Its question is: what might this comment mean at the human',
  'level? For a single voice, notice what it may reveal about:',
  '- unmet needs',
  '- fears',
  '- hopes',
  '- identity concerns',
  '- belonging signals',
  '- trust signals',
  '- dignity concerns',
  '- moments of pain or aspiration',
  '',
  'You are given a JSON object with a list of prior findings (each the faithfully surfaced words',
  'of ONE voice), each carrying its `findingId` and its `content` (the voice). Interpret the',
  'voices, one at a time. Rules:',
  '- INTERPRET ONE VOICE AT A TIME. Do NOT consolidate, compare, or synthesize across voices, and',
  '  do NOT count how often something recurs — that is a later lens\'s job. Each finding you return',
  '  is about a single voice.',
  '- You MAY return MORE THAN ONE finding for a voice when it carries more than one human meaning',
  '  (for example an unmet need AND a fear) — return each as its own finding.',
  '- Each finding MUST name, in `sourceFindingId`, the `findingId` of the SINGLE prior voice it',
  '  interprets — copied exactly from the input. Do NOT return unit ids; the anchor is inherited',
  '  from that one voice. A finding that names no prior voice (or one not in the input) is not',
  '  allowed — omit it.',
  '- Stay close to what the voice could plausibly mean. Do not add a story, a cause, or surrounding',
  '  context the voice does not carry; where you would have to guess, say less. A convincing guess',
  '  reads exactly like evidence, which is why it is prohibited.',
  '- For some responses the potential meaning cannot be grounded in the words themselves: any reading',
  '  would have to be imported from context this unit does not carry. "n/a", "idk", "No comment", a',
  '  bare "." are the clear cases — but judge by that CONDITION (meaning not grounded in the words',
  '  alone), not the exact string. For such a response, do NOT supply a meaning, not even a hedged one',
  '  ("may signal uncertainty" already assigns a meaning). Emit a noticing that NAMES it as an answer',
  '  whose potential meaning and importance are best understood in context — worth exploring as such',
  '  — and stop there. Do NOT characterize the answer ("empty", "a non-answer", and the like are out)',
  '  and do NOT classify what kind of token it is; leave any actual exploration of its contextual',
  '  meaning to later lenses. A response whose meaning IS discernible in its own words (for example',
  '  "I\'ve stopped putting in extra effort — it just goes unnoticed") is not this case — interpret',
  '  it normally.',
  '',
  'Emit each finding\'s interpretation in the "noticing" field — your own words describing the human',
  'meaning, NOT a quote of the speaker (the speaker\'s words are surfaced by an earlier lens). Return',
  'ONLY a JSON object of exactly this shape, with no surrounding prose, explanation, or markdown',
  'fences:',
  '{"findings":[{"noticing":"...","sourceFindingId":"..."}]}',
].join('\n');

/** One interpretation the model returns: the human meaning, plus the voice it interprets. */
interface MeaningCandidate {
  readonly noticing: string;
  readonly sourceFindingId: string;
}

export class HumanMeaningLens implements Lens {
  readonly id = 'meaning';
  readonly wave: Wave = 'meaning';

  async run(
    units: readonly Unit[],
    priorFindings: readonly Finding[],
    provider: LlmProvider,
  ): Promise<readonly Finding[]> {
    // Meaning is synthesized FROM the prior (Listening) findings; with none to interpret,
    // the lens stays silent rather than straining over the raw units. This also makes its
    // dependence on the Evidence wave observable and deterministic.
    if (priorFindings.length === 0) {
      return [];
    }

    const payload: LensPromptPayload = {
      instruction: INSTRUCTION,
      units: units.map((u) => ({
        unitId: u.unitId,
        speakerToken: u.speakerToken,
        content: u.content,
      })),
      priorFindings: priorFindings.map(toPromptFinding),
    };

    const response = await provider.complete({ system: SYSTEM, prompt: JSON.stringify(payload) });

    // Non-natural finish (refusal / truncation / out-of-protocol) — do not parse.
    // Findings-level silence as ever; the accounting layer records this call
    // delivered-but-unusable, never answered-empty (G-1 routing; see listening-lens).
    if (routeLlmResponse(response).kind === 'unusable') {
      return [];
    }

    const candidates = parseCandidates(response.text);

    // The anchor is INHERITED from the named source voice, never taken from a model unit
    // link. A voice is a prior finding; its single unit is the finding's anchor. Looking it
    // up here means: an unknown/unresolvable source is dropped (silence), and a meaning
    // finding structurally carries exactly ONE unit — it cannot span voices.
    const bySourceId = new Map(priorFindings.map((f) => [f.findingId, f]));
    const inScope = new Set(units.map((u) => u.unitId));

    const findings: Finding[] = [];
    candidates.forEach((candidate, index) => {
      const source = bySourceId.get(candidate.sourceFindingId);
      // The one unit behind the interpreted voice (single by the one-voice-one-unit
      // invariant; sliced to one so a Human Meaning finding structurally never spans).
      const anchorUnit = source?.evidenceLinks[0];
      if (anchorUnit === undefined || !inScope.has(anchorUnit)) {
        // Source not resolvable, or its unit is not in this run's cleared set -> drop
        // (silence), rather than assert a meaning on a unit we cannot vouch for.
        return;
      }
      findings.push(
        makeOrdinaryFinding({
          findingId: `${this.id}:${index}`,
          lens: 'meaning',
          noticing: candidate.noticing,
          evidenceLinks: [anchorUnit],
          units,
        }),
      );
    });
    return findings;
  }
}

/**
 * Tolerant parse of the model's text into the meaning-candidate shape. Provider output
 * is untrusted: any failure — empty text, a markdown fence, prose, non-object JSON, a
 * missing `findings` array, or a candidate whose fields are the wrong type — yields the
 * candidates that ARE well-formed (often none), never a thrown error. This is the
 * "model misbehaved -> silence" half of the safe failure mode; the source lookup in `run`
 * then enforces a real, in-scope anchor on whatever survives.
 *
 * Both `noticing` and `sourceFindingId` are required non-empty strings; a candidate that
 * lacks either is dropped.
 */
function parseCandidates(text: string): readonly MeaningCandidate[] {
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
  const candidates: MeaningCandidate[] = [];
  for (const raw of findings) {
    if (typeof raw !== 'object' || raw === null) {
      continue;
    }
    const noticing = (raw as { noticing?: unknown }).noticing;
    const sourceFindingId = (raw as { sourceFindingId?: unknown }).sourceFindingId;
    if (typeof noticing !== 'string' || noticing.trim() === '') {
      continue;
    }
    if (typeof sourceFindingId !== 'string' || sourceFindingId.trim() === '') {
      continue;
    }
    candidates.push({ noticing, sourceFindingId });
  }
  return candidates;
}

/** Strip a single ```json ... ``` (or bare ``` ... ```) fence if the model wrapped its JSON in one. */
function stripFence(text: string): string {
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  return fence ? fence[1].trim() : text;
}
