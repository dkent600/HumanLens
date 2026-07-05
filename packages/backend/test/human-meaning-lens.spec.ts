import { describe, expect, it } from 'vitest';
import { HumanMeaningLens } from '../src/engine/lenses/human-meaning-lens.js';
import {
  FakeLlmProvider,
  type LensPromptPayload,
  type LensResponsePayload,
} from '../src/seams/llm-provider.js';
import { isEvidenceAnchored, makeOrdinaryFinding, type Finding } from '../src/domain/finding.js';
import type { Unit } from '../src/domain/types.js';

// The Human Meaning lens is the single lens of the Meaning wave. Post-funnel it is
// INTERPRETIVE and reads the PRIOR (Listening) findings, not the raw units: it interprets
// each voice on its own (per-voice) and emits its text as a `noticing` (verbatim null,
// Model B). Its anchor is INHERITED from the source voice it names (`sourceFindingId`),
// never taken from a model-emitted unit link — so a meaning finding structurally carries
// exactly ONE unit and cannot span voices, and an unresolvable source is dropped (silence).
// It may emit MORE THAN ONE noticing per voice — the first lens that exercises
// multi-finding-per-lens (Item 11).

function clearedUnit(unitId: string, speakerToken: string): Unit {
  return {
    unitId,
    engagementId: 'eng:1',
    ingestedBy: 'actor:test',
    ingestedAt: '2026-01-01T00:00:00.000Z',
    sourceRef: 'src',
    position: 0,
    language: 'en',
    content: `content for ${unitId}`,
    deidStatus: 'cleared',
    speakerToken,
  };
}

function clearedUnitInLanguage(unitId: string, speakerToken: string, language: string): Unit {
  return { ...clearedUnit(unitId, speakerToken), language };
}

const units: readonly Unit[] = [
  clearedUnit('u1', 'spk-a'),
  clearedUnit('u2', 'spk-b'),
];

/** A Listening (Evidence-wave, surfacing) finding to feed the Human Meaning lens as prior input. */
function listeningFinding(findingId: string, evidenceLinks: readonly string[]): Finding {
  return makeOrdinaryFinding({
    findingId,
    lens: 'listening',
    verbatim: 'a surfaced voice',
    evidenceLinks,
    units,
  });
}

/** A fake that interprets the first prior voice, naming it by sourceFindingId (unit ids unused). */
function interpretsFirstVoice(noticing = 'a human meaning'): FakeLlmProvider {
  return new FakeLlmProvider((payload): LensResponsePayload => ({
    findings: [
      { noticing, sourceFindingId: payload.priorFindings?.[0]?.findingId ?? '', evidenceUnitIds: [] },
    ],
  }));
}

describe('Human Meaning lens — Meaning wave, inherits its anchor from the source voice', () => {
  it('stays silent when there are no prior findings to interpret', async () => {
    const out = await new HumanMeaningLens().run(units, [], new FakeLlmProvider());
    expect(out).toHaveLength(0);
  });

  it('interprets a voice: emits a noticing (verbatim null), inheriting that voice\'s unit, held by default', async () => {
    const prior = [listeningFinding('listening:0', ['u1'])];
    const out = await new HumanMeaningLens().run(units, prior, interpretsFirstVoice());

    expect(out).toHaveLength(1);
    const [meaning] = out;
    expect(meaning.lens).toBe('meaning');
    expect(meaning.findingId).toBe('meaning:0');
    expect(meaning.verbatim).toBeNull(); // interpretive: it does not quote
    expect(meaning.noticing).not.toBeNull(); // ...its text is a noticing
    expect(isEvidenceAnchored(meaning)).toBe(true);
    expect([...meaning.evidenceLinks]).toEqual(['u1']); // inherited from listening:0
    expect(meaning.clearedToClientSafe).toBe(false); // held by default
  });

  it('carries exactly ONE unit even when the source voice spans several (structural single-unit)', async () => {
    // A (hypothetical) multi-unit source voice. The meaning still inherits exactly one
    // unit — it can never consolidate a source's units, let alone span across voices.
    const prior = [listeningFinding('listening:0', ['u1', 'u2'])];
    const out = await new HumanMeaningLens().run(units, prior, interpretsFirstVoice());

    expect(out).toHaveLength(1);
    expect([...out[0]!.evidenceLinks]).toEqual(['u1']); // one unit, not ['u1','u2']
    expect(out[0]!.supportSet).toEqual({ sourceCount: 1, unitCount: 1 });
  });

  it('emits MULTIPLE noticings for one voice, id-suffixed (Item 11: multi-finding per lens)', async () => {
    // A voice that carries more than one human meaning (an unmet need AND a fear), both
    // naming the same source voice. The lens id-suffixes them meaning:0, meaning:1.
    const prior = [listeningFinding('listening:0', ['u1'])];
    const multi = new FakeLlmProvider(
      (): LensResponsePayload => ({
        findings: [
          { noticing: 'an unmet need for recognition', sourceFindingId: 'listening:0', evidenceUnitIds: [] },
          { noticing: 'a fear of speaking up', sourceFindingId: 'listening:0', evidenceUnitIds: [] },
        ],
      }),
    );

    const out = await new HumanMeaningLens().run(units, prior, multi);

    expect(out.map((f) => f.findingId)).toEqual(['meaning:0', 'meaning:1']); // suffixing past :0
    expect(out.map((f) => f.noticing)).toEqual([
      'an unmet need for recognition',
      'a fear of speaking up',
    ]);
    // Per-voice single-unit: each meaning inherits that one voice's unit, no spanning.
    for (const meaning of out) {
      expect([...meaning.evidenceLinks]).toEqual(['u1']);
      expect(meaning.verbatim).toBeNull();
    }
  });

  it('passes the prior findings to the provider (it reads findings, not just units)', async () => {
    let seen: LensPromptPayload | undefined;
    const spy = new FakeLlmProvider((payload): LensResponsePayload => {
      seen = payload;
      return { findings: [] };
    });
    await new HumanMeaningLens().run(units, [listeningFinding('listening:0', ['u1'])], spy);

    expect(seen?.priorFindings?.map((f) => f.findingId)).toEqual(['listening:0']);
    expect(seen?.priorFindings?.[0]?.evidenceUnitIds).toEqual(['u1']);
  });

  it('drops a noticing whose named source voice does not exist (mis-anchor -> silence)', async () => {
    const rogue = new FakeLlmProvider(
      (): LensResponsePayload => ({
        findings: [{ noticing: 'an ungrounded meaning', sourceFindingId: 'no-such-voice', evidenceUnitIds: [] }],
      }),
    );
    const out = await new HumanMeaningLens().run(units, [listeningFinding('listening:0', ['u1'])], rogue);
    expect(out).toHaveLength(0);
  });

  it('is deterministic — same prior findings yield the same output', async () => {
    const prior = [listeningFinding('listening:0', ['u1'])];
    const a = await new HumanMeaningLens().run(units, prior, interpretsFirstVoice());
    const b = await new HumanMeaningLens().run(units, prior, interpretsFirstVoice());
    expect(a).toEqual(b);
  });

  // Item 9 (EN/ES): a Spanish-origin voice flows through the funnel. The Spanish lives in
  // the underlying Listening finding's verbatim/translation; the lens reads the English
  // translation as working text, and its noticing is English, anchored to the Spanish unit.
  it('carries a Spanish voice through as English working text, anchored to the es unit', async () => {
    const esUnits: readonly Unit[] = [clearedUnitInLanguage('u-es', 'spk-es', 'es')];
    const spanishListening = makeOrdinaryFinding({
      findingId: 'listening:0',
      lens: 'listening',
      verbatim: 'No me siento seguro compartiendo lo que pienso',
      translation: 'I do not feel safe sharing what I think',
      sourceLanguage: 'Spanish',
      evidenceLinks: ['u-es'],
      units: esUnits,
    });

    // The lens reads the prior finding via the shared projection, which resolves the
    // working text to the English translation (noticing ?? translation ?? verbatim).
    let seenContent: string | undefined;
    const spy = new FakeLlmProvider((payload): LensResponsePayload => {
      seenContent = payload.priorFindings?.[0]?.content;
      return {
        findings: [
          { noticing: 'a fear of speaking up without safety', sourceFindingId: 'listening:0', evidenceUnitIds: [] },
        ],
      };
    });

    const out = await new HumanMeaningLens().run(esUnits, [spanishListening], spy);

    expect(seenContent).toBe('I do not feel safe sharing what I think'); // English working text
    expect(out).toHaveLength(1);
    expect(out[0]?.noticing).toBe('a fear of speaking up without safety'); // English noticing
    expect(out[0]?.verbatim).toBeNull();
    expect([...out[0]!.evidenceLinks]).toEqual(['u-es']); // inherited the Spanish voice's unit
  });

  // An answer whose meaning cannot be read from its own words ("n/a", "idk", "No comment",
  // ".") must be FLAGGED as best understood in context, not assigned a (even hedged) meaning;
  // a normal thin-but-readable answer is still interpreted. The flag-vs-interpret decision is
  // a PROMPT rule the model applies — the lens carries whatever noticing it returns without
  // special-casing, so these tests pin the SHAPE side of the contract (both produce an ordinary
  // held single-unit noticing). The model's JUDGMENT itself is exercised against the real model
  // in the eval (`npm run eval -- meaning`).
  it('carries a flag-for-exploration noticing as an ordinary held single-unit finding (shape unchanged)', async () => {
    const prior = [listeningFinding('listening:0', ['u1'])]; // stands in for an "n/a"-type voice
    const flags = new FakeLlmProvider((): LensResponsePayload => ({
      findings: [
        {
          noticing:
            'This response is best understood in context; its potential meaning and importance are worth exploring.',
          sourceFindingId: 'listening:0',
          evidenceUnitIds: [],
        },
      ],
    }));

    const [meaning] = await new HumanMeaningLens().run(units, prior, flags);
    expect(meaning.noticing).toMatch(/best understood in context/); // flags rather than interprets
    expect(meaning.verbatim).toBeNull();
    expect([...meaning.evidenceLinks]).toEqual(['u1']); // per-voice, single-unit
    expect(meaning.clearedToClientSafe).toBe(false); // held by default
  });

  it('still interprets a normal thin-but-readable answer (pins the boundary)', async () => {
    const prior = [listeningFinding('listening:0', ['u1'])];
    const out = await new HumanMeaningLens().run(
      units,
      prior,
      interpretsFirstVoice('an unmet need for recognition'),
    );
    expect(out[0]?.noticing).toBe('an unmet need for recognition'); // a real interpretation, carried
  });
});
