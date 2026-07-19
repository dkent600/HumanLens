import type { Unit } from '../../domain/types.js';
import type { Finding } from '../../domain/finding.js';
import { makeOrdinaryFinding } from '../../domain/finding.js';
import type { LensPromptPayload, LlmProvider } from '../../seams/llm-provider.js';
import type { Wave, Lens } from './lens.js';
import { toPromptFinding } from './prompt-projection.js';
import { runPerVoiceLens, type PerVoiceLens } from '../completeness/per-voice-lens.js';
import type { ParsedVoiceBody, VoiceOperation } from '../completeness/voice-orchestrator.js';
import type { QuarantinedFinding } from '../completeness/terminal-state.js';

// The Human Meaning Lens — the single lens of the Meaning wave: "what might these comments
// mean at the human level?" (unmet needs, fears, hopes, identity concerns, belonging/trust
// signals, dignity concerns, moments of pain or aspiration).
//
// EVIDENCE FUNNEL + PER-VOICE FAN-OUT. Human Meaning reads the PRIOR-wave (Listening)
// findings, not the raw units; a VOICE is one Listening finding. It runs through the
// production orchestrator — ONE model call per prior voice, keyed by that finding's id,
// four-state ledger, retry/termination. The lens no longer calls the model itself; it
// supplies a VoiceOperation and the orchestrator does the fan-out.
//
// SINGLE-UNIT ANCHOR (structural). Each call interprets ONE prior voice; the meaning inherits
// that voice's single unit as its anchor — the model does not emit a unit link. So a meaning
// finding provably carries exactly one unit and cannot span voices. PROVENANCE (P3): the model
// names, in `sourceFindingId`, the voice it interprets; a name that is not THIS call's voice
// (a different valid voice, or an unknown id) is quarantined, never attributed.
//
// COMPLETENESS INVARIANT (declared, enforced by the orchestrator): answered-empty is NEVER
// legitimate for Human Meaning — every voice yields >=1 finding, because even an ungroundable
// answer still gets the worth-exploring flag (build_approach.md, "Where meaning can't be
// grounded…"). A voice that comes back empty is recorded as an invariant VIOLATION alongside
// the truthful answered-empty state — never retried (P7), never rerouted.

const INSTRUCTION =
  'Interpret each prior voice at the human level. Return findings; each must carry a noticing and name, in sourceFindingId, the single prior voice it interprets.';

// The versioned system contract — UNCHANGED by this task. Written for "a list of prior
// findings"; a per-voice call passes a one-element list.
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
  '- Some responses do not settle their own meaning in their words, and these you FLAG rather than',
  '  read. Two ways it happens, both flagged: (a) there is nothing to read — the response withholds',
  '  content ("n/a", "idk", "No comment", a bare "."); (b) the response UNDERCUTS ITSELF — a hedge or',
  '  qualifier destabilizes the very thing it attaches to ("Things are fine, I guess"), so the plain',
  '  reading cannot be taken at face value. Judge by that CONDITION (do the words settle the meaning?),',
  '  never by the exact string, and never by classifying what kind of token it is — you are reading',
  '  what the voice actually carries: for "Things are fine, I guess" there is a hedge to read; for',
  '  "n/a" there is not.',
  '- When you flag, GROUND the flag in what IS there and defer ONLY the unresolved part — do not claim',
  '  that nothing can be read. For a SELF-UNDERCUTTING voice, name the grounded observation: the speaker',
  '  qualified their own answer, so the plain reading should not be taken at face value and something',
  '  here is left for context to resolve — worth exploring, with that hedge as the lead for a follow-up.',
  '  For a WITHHELD answer, the words give nothing to ground a reading on — name it as an answer whose',
  '  meaning is best understood in context, worth exploring, and stop. In NEITHER case characterize the',
  '  answer ("empty",',
  '  "non-committal", "a non-answer" are out), and do NOT read a motive, an intent, or a stance toward',
  '  the question into it. A response whose meaning IS settled in its own words (for example "I\'ve',
  '  stopped putting in extra effort — it just goes unnoticed") is not this case — interpret it normally.',
  '- STOPPING DISCIPLINE. Every clause of a noticing must point to something the speaker actually said.',
  '  Before you return a noticing, check each clause: if it cannot be traced back to the words, cut it.',
  '  Never reach for motive, intent, or a stance toward the question to round out a reading — a clause',
  '  of unfounded interpretation is worse than a shorter noticing. (This targets unfounded clauses, NOT',
  '  long ones: where the words support depth, go there.)',
  '',
  'Emit each finding\'s interpretation in the "noticing" field — your own words describing the human',
  'meaning, NOT a quote of the speaker (the speaker\'s words are surfaced by an earlier lens). Return',
  'ONLY a JSON object of exactly this shape, with no surrounding prose, explanation, or markdown',
  'fences:',
  '{"findings":[{"noticing":"...","sourceFindingId":"..."}]}',
].join('\n');

export class HumanMeaningLens implements Lens, PerVoiceLens<Finding> {
  readonly id = 'meaning';
  readonly wave: Wave = 'meaning';

  /** A voice is one prior (Listening) finding. */
  voiceIds(_units: readonly Unit[], priorFindings: readonly Finding[]): readonly string[] {
    return priorFindings.map((f) => f.findingId);
  }

  operation(
    units: readonly Unit[],
    priorFindings: readonly Finding[],
    provider: LlmProvider,
  ): VoiceOperation<Finding> {
    const bySourceId = new Map(priorFindings.map((f) => [f.findingId, f]));
    const voiceIndexById = new Map(priorFindings.map((f, i) => [f.findingId, i]));
    const inScopeUnits = new Set(units.map((u) => u.unitId));

    return {
      call: (voiceId) => {
        const source = bySourceId.get(voiceId);
        if (source === undefined) throw new Error(`HumanMeaningLens: unknown voice ${voiceId}`);
        // One prior voice per call — the prompt's "list of prior findings" is a one-element list.
        const payload: LensPromptPayload = {
          instruction: INSTRUCTION,
          units: units.map((u) => ({ unitId: u.unitId, speakerToken: u.speakerToken, content: u.content })),
          priorFindings: [toPromptFinding(source)],
        };
        return provider.complete({ system: SYSTEM, prompt: JSON.stringify(payload) });
      },
      parse: (text, voiceId) =>
        parseVoice(text, voiceId, voiceIndexById.get(voiceId) ?? 0, bySourceId, inScopeUnits, units),
      // Human Meaning never legitimately answers empty — every voice yields >=1 finding.
      answeredEmptyLegitimate: () => false,
    };
  }

  async run(
    units: readonly Unit[],
    priorFindings: readonly Finding[],
    provider: LlmProvider,
  ): Promise<readonly Finding[]> {
    const { findings } = await runPerVoiceLens(this, units, priorFindings, provider);
    return findings;
  }
}

/** One interpretation the model returns: the human meaning, plus the voice it interprets. */
interface MeaningCandidate {
  readonly noticing: string;
  readonly sourceFindingId: string;
}

/**
 * Parse ONE prior voice's response into meaning findings. A malformed body → `{ usable: false }`
 * (delivered-but-unusable). A well-formed body: a candidate naming THIS voice is attributed,
 * inheriting the source voice's single unit as its anchor; a candidate naming a DIFFERENT valid
 * voice, or an unknown id, is quarantined, never attributed (P3). No attributable finding and
 * nothing quarantined → usable empty (the orchestrator resolves answered-empty; Human Meaning
 * declares that illegitimate, so it is recorded as a violation).
 */
function parseVoice(
  text: string,
  voiceId: string,
  voiceIndex: number,
  bySourceId: ReadonlyMap<string, Finding>,
  inScopeUnits: ReadonlySet<string>,
  units: readonly Unit[],
): ParsedVoiceBody<Finding> {
  const envelope = parseEnvelope(text);
  if (!envelope.ok) {
    return { usable: false };
  }

  const attributed: Finding[] = [];
  const quarantined: QuarantinedFinding[] = [];
  for (const candidate of envelope.candidates) {
    if (candidate.sourceFindingId === voiceId) {
      const source = bySourceId.get(voiceId);
      const anchorUnit = source?.evidenceLinks[0];
      if (anchorUnit !== undefined && inScopeUnits.has(anchorUnit)) {
        attributed.push(
          makeOrdinaryFinding({
            findingId: `meaning:${voiceIndex}-${attributed.length}`,
            lens: 'meaning',
            noticing: candidate.noticing,
            evidenceLinks: [anchorUnit],
            units,
          }),
        );
      }
      // An unresolvable source (or its unit out of scope) → drop (cannot vouch for an anchor).
    } else if (bySourceId.has(candidate.sourceFindingId)) {
      quarantined.push({ claimedVoiceId: candidate.sourceFindingId, reason: 'foreign-voice' });
    } else {
      quarantined.push({ claimedVoiceId: candidate.sourceFindingId, reason: 'unknown-voice' });
    }
  }
  return { usable: true, findings: attributed, quarantined };
}

type Envelope =
  | { readonly ok: false }
  | { readonly ok: true; readonly candidates: readonly MeaningCandidate[] };

/**
 * Tolerant parse into the meaning-candidate envelope. An empty string or a well-formed
 * `{"findings":[...]}` → `ok:true` (possibly empty); prose, non-object JSON, or a missing
 * `findings` array → `ok:false`. Both `noticing` and `sourceFindingId` are required non-empty
 * strings; a candidate lacking either is dropped.
 */
function parseEnvelope(text: string): Envelope {
  const body = stripFence(text.trim());
  if (body === '') {
    return { ok: true, candidates: [] };
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
  const candidates: MeaningCandidate[] = [];
  for (const raw of findings) {
    if (typeof raw !== 'object' || raw === null) continue;
    const noticing = (raw as { noticing?: unknown }).noticing;
    const sourceFindingId = (raw as { sourceFindingId?: unknown }).sourceFindingId;
    if (typeof noticing !== 'string' || noticing.trim() === '') continue;
    if (typeof sourceFindingId !== 'string' || sourceFindingId.trim() === '') continue;
    candidates.push({ noticing, sourceFindingId });
  }
  return { ok: true, candidates };
}

/** Strip a single ```json ... ``` (or bare ``` ... ```) fence if the model wrapped its JSON in one. */
function stripFence(text: string): string {
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  return fence ? fence[1].trim() : text;
}
