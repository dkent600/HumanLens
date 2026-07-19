import { describe, expect, it } from 'vitest';
import { ListeningLens } from '../src/engine/lenses/listening-lens.js';
import {
  FakeLlmProvider,
  type LensResponsePayload,
  type LlmProvider,
} from '../src/seams/llm-provider.js';
import { isEvidenceAnchored } from '../src/domain/finding.js';
import type { Unit } from '../src/domain/types.js';

/** A provider that returns whatever raw text we hand it — so we can exercise the
 *  lens's tolerant parse against real-model-shaped output (fences, prose, bad fields)
 *  that the JSON-stringifying FakeLlmProvider cannot produce. */
function textProvider(text: string): LlmProvider {
  return { complete: () => Promise.resolve({ text }) };
}

// The Listening Lens is the first Evidence-wave lens — the seed of the pipeline. It
// reads the cleared units directly. For PARITY with every other lens (each of which has
// its own rogue/drop test), this proves anchoring is ENFORCED on Listening too: a
// candidate citing an out-of-scope unit id is dropped, never asserted. Listening had no
// own spec before, so its drop branch was exercised by no test — only its happy path,
// indirectly, through the pipeline.

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

const units: readonly Unit[] = [clearedUnit('u1', 'spk-a'), clearedUnit('u2', 'spk-b')];

describe('Listening lens — Evidence wave, reads units directly', () => {
  it('is silent when there are no units', async () => {
    const out = await new ListeningLens().run([], [], new FakeLlmProvider());
    expect(out).toHaveLength(0);
  });

  it('emits one finding per voice (per-voice fan-out), each anchored to its unit, held by default', async () => {
    const out = await new ListeningLens().run(units, [], new FakeLlmProvider());

    // Per-voice: one Listening call per unit, one finding per unit — never one finding
    // spanning both (cross-source support is the Aggregate lenses' job now).
    expect(out.map((f) => f.findingId)).toEqual(['listening:0-0', 'listening:1-0']);
    for (const f of out) {
      expect(f.lens).toBe('listening');
      expect(isEvidenceAnchored(f)).toBe(true);
      expect(f.supportSet).toEqual({ sourceCount: 1, unitCount: 1 }); // derived, honest
      expect(f.clearedToClientSafe).toBe(false); // held by default
    }
    expect([...out[0].evidenceLinks]).toEqual(['u1']);
    expect([...out[1].evidenceLinks]).toEqual(['u2']);
  });

  it('drops a candidate whose only anchor is out of scope (anchoring enforced)', async () => {
    // A model that cites a unit id not in this run's cleared set. An ordinary finding
    // cannot exist without a valid anchor, so the hallucinated anchor is dropped.
    const rogue = new FakeLlmProvider(
      (): LensResponsePayload => ({
        findings: [{ verbatim: 'an ungrounded theme', evidenceUnitIds: ['not-in-scope'] }],
      }),
    );
    const out = await new ListeningLens().run(units, [], rogue);
    expect(out).toHaveLength(0);
  });

  it('is deterministic — same units yield the same finding', async () => {
    const a = await new ListeningLens().run(units, [], new FakeLlmProvider());
    const b = await new ListeningLens().run(units, [], new FakeLlmProvider());
    expect(a).toEqual(b);
  });
});

describe('Listening lens — real-model output: tolerant parse + anchoring on the parsed text', () => {
  it('parses bare JSON into an anchored, held-by-default finding (English: no translation)', async () => {
    const provider = textProvider('{"findings":[{"verbatim":"the workload is heavy","evidenceUnitIds":["u1"]}]}');
    const out = await new ListeningLens().run(units, [], provider);

    expect(out).toHaveLength(1);
    expect(out[0].findingId).toBe('listening:0-0');
    expect(out[0].verbatim).toBe('the workload is heavy'); // the speaker's words, untouched
    expect(out[0].translation).toBeUndefined();
    expect(out[0].sourceLanguage).toBeUndefined();
    expect([...out[0].evidenceLinks]).toEqual(['u1']);
    expect(out[0].clearedToClientSafe).toBe(false);
  });

  it('carries verbatim + translation + sourceLanguage for a non-English unit', async () => {
    const provider = textProvider(
      '{"findings":[{"verbatim":"No me siento seguro","translation":"I do not feel safe","sourceLanguage":"Spanish","evidenceUnitIds":["u1"]}]}',
    );
    const out = await new ListeningLens().run(units, [], provider);

    expect(out).toHaveLength(1);
    expect(out[0].verbatim).toBe('No me siento seguro'); // original kept verbatim
    expect(out[0].translation).toBe('I do not feel safe');
    expect(out[0].sourceLanguage).toBe('Spanish');
  });

  it('handles a mixed-language unit: verbatim as-is, whole-thing translation, source language named', async () => {
    const provider = textProvider(
      '{"findings":[{"verbatim":"They keep promising change pero todo sigue igual","translation":"They keep promising change but everything stays the same","sourceLanguage":"Spanish","evidenceUnitIds":["u2"]}]}',
    );
    const out = await new ListeningLens().run(units, [], provider);

    expect(out).toHaveLength(1);
    expect(out[0].verbatim).toBe('They keep promising change pero todo sigue igual');
    expect(out[0].translation).toBe('They keep promising change but everything stays the same');
    expect(out[0].sourceLanguage).toBe('Spanish');
  });

  it('keeps verbatim when only one of translation/sourceLanguage is present (degraded, not dropped)', async () => {
    // A real model could emit a lone field; the pair is ignored but the voice is kept.
    const provider = textProvider('{"findings":[{"verbatim":"workload is heavy","translation":"x","evidenceUnitIds":["u1"]}]}');
    const out = await new ListeningLens().run(units, [], provider);

    expect(out).toHaveLength(1);
    expect(out[0].verbatim).toBe('workload is heavy');
    expect(out[0].translation).toBeUndefined(); // lone field ignored
    expect(out[0].sourceLanguage).toBeUndefined();
  });

  it('tolerates a ```json fence around the JSON', async () => {
    const provider = textProvider('```json\n{"findings":[{"verbatim":"theme","evidenceUnitIds":["u1","u2"]}]}\n```');
    const out = await new ListeningLens().run(units, [], provider);

    // Per-voice: each unit's call attributes the finding to its OWN unit (the stray
    // cross-unit cite is trimmed) — the fence is tolerated on each call.
    expect(out.map((f) => f.findingId)).toEqual(['listening:0-0', 'listening:1-0']);
    expect([...out[0].evidenceLinks]).toEqual(['u1']);
    expect([...out[1].evidenceLinks]).toEqual(['u2']);
    expect(out[0].supportSet).toEqual({ sourceCount: 1, unitCount: 1 });
  });

  it('returns no findings when the model answers in prose (silence, not a crash)', async () => {
    const provider = textProvider('Sure! Here are the themes I noticed across the comments...');
    const out = await new ListeningLens().run(units, [], provider);
    expect(out).toHaveLength(0);
  });

  it('returns no findings for empty text or a payload with no findings array', async () => {
    expect(await new ListeningLens().run(units, [], textProvider(''))).toHaveLength(0);
    expect(await new ListeningLens().run(units, [], textProvider('{}'))).toHaveLength(0);
  });

  it('drops a malformed candidate but keeps the well-formed ones', async () => {
    // First candidate has no `verbatim`; second has a string (not array) evidenceUnitIds;
    // only the third is well-formed.
    const provider = textProvider(
      '{"findings":[{"evidenceUnitIds":["u1"]},{"verbatim":"x","evidenceUnitIds":"u1"},{"verbatim":"ok","evidenceUnitIds":["u2"]}]}',
    );
    const out = await new ListeningLens().run(units, [], provider);

    expect(out).toHaveLength(1);
    expect(out[0].verbatim).toBe('ok');
    expect([...out[0].evidenceLinks]).toEqual(['u2']);
  });

  it('drops a candidate with empty or whitespace-only verbatim (non-authored structural emptiness)', async () => {
    // Structural emptiness — the person authored nothing — is the ONLY drop category.
    const empty = await new ListeningLens().run(units, [], textProvider('{"findings":[{"verbatim":"","evidenceUnitIds":["u1"]}]}'));
    const whitespace = await new ListeningLens().run(units, [], textProvider('{"findings":[{"verbatim":"   ","evidenceUnitIds":["u1"]}]}'));
    expect(empty).toHaveLength(0);
    expect(whitespace).toHaveLength(0);
  });

  it('surfaces an authored terse token verbatim, however opaque ("n/a", ".", "IDK", "No comment")', async () => {
    // The surfacing bar is "did the person author an utterance?" — any authored token
    // surfaces as the fact it was said, its verbatim intact. Listening does NOT classify
    // what such a token means (declination vs. uncertainty vs. thin-but-real is downstream).
    for (const token of ['n/a', '.', 'IDK', 'No comment']) {
      const provider = textProvider(`{"findings":[{"verbatim":${JSON.stringify(token)},"evidenceUnitIds":["u1"]}]}`);
      const out = await new ListeningLens().run(units, [], provider);
      expect(out, `authored token ${JSON.stringify(token)} should surface`).toHaveLength(1);
      expect(out[0].verbatim).toBe(token); // carried verbatim, intact
    }
  });

  it('trims an out-of-scope (hallucinated) id while keeping the valid anchor', async () => {
    // Schema-valid JSON can still carry an id the model invented; the anchoring guard
    // drops it, keeping only the in-scope anchor — derived support reflects what is left.
    const provider = textProvider('{"findings":[{"verbatim":"grounded","evidenceUnitIds":["u1","nope"]}]}');
    const out = await new ListeningLens().run(units, [], provider);

    expect(out).toHaveLength(1);
    expect([...out[0].evidenceLinks]).toEqual(['u1']);
    expect(out[0].supportSet).toEqual({ sourceCount: 1, unitCount: 1 });
  });

  it('drops a candidate whose anchors are all out of scope', async () => {
    const provider = textProvider('{"findings":[{"verbatim":"ungrounded","evidenceUnitIds":["nope"]}]}');
    const out = await new ListeningLens().run(units, [], provider);
    expect(out).toHaveLength(0);
  });

  it('emits MULTIPLE findings for ONE voice when the speaker bound two unrelated things (the split rule, u6)', async () => {
    // build_approach.md L577: two genuinely unrelated things in one comment -> two findings.
    // Per-voice fan-out imposes NO one-finding cap: both candidates cite this voice's unit
    // and both surface, id-suffixed past :0, each anchored to that same single unit.
    const oneUnit = [clearedUnit('u1', 'spk-a')];
    const provider = textProvider(
      '{"findings":[{"verbatim":"the onboarding process is a real improvement","evidenceUnitIds":["u1"]},' +
        '{"verbatim":"the third-floor kitchen has been out of order for weeks","evidenceUnitIds":["u1"]}]}',
    );
    const out = await new ListeningLens().run(oneUnit, [], provider);

    expect(out.map((f) => f.findingId)).toEqual(['listening:0-0', 'listening:0-1']);
    expect(out.map((f) => f.verbatim)).toEqual([
      'the onboarding process is a real improvement',
      'the third-floor kitchen has been out of order for weeks',
    ]);
    for (const f of out) expect([...f.evidenceLinks]).toEqual(['u1']); // each anchored to the one unit
  });
});
