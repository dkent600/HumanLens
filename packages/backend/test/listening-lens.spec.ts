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

// The Listening Lens is the first Evidence-layer lens — the seed of the pipeline. It
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

describe('Listening lens — Evidence layer, reads units directly', () => {
  it('is silent when there are no units', async () => {
    const out = await new ListeningLens().run([], [], new FakeLlmProvider());
    expect(out).toHaveLength(0);
  });

  it('emits a finding anchored to the units it read, held by default', async () => {
    const out = await new ListeningLens().run(units, [], new FakeLlmProvider());

    expect(out).toHaveLength(1);
    const [listening] = out;
    expect(listening.lens).toBe('listening');
    expect(listening.findingId).toBe('listening:0');
    expect(isEvidenceAnchored(listening)).toBe(true);
    expect([...listening.evidenceLinks].sort()).toEqual(['u1', 'u2']);
    expect(listening.supportSet).toEqual({ sourceCount: 2, unitCount: 2 }); // derived, honest
    expect(listening.clearedToClientSafe).toBe(false); // held by default
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
    expect(out[0].findingId).toBe('listening:0');
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

    expect(out).toHaveLength(1);
    expect([...out[0].evidenceLinks].sort()).toEqual(['u1', 'u2']);
    expect(out[0].supportSet).toEqual({ sourceCount: 2, unitCount: 2 });
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

  it('drops a candidate with empty verbatim (contentless)', async () => {
    const provider = textProvider('{"findings":[{"verbatim":"   ","evidenceUnitIds":["u1"]}]}');
    const out = await new ListeningLens().run(units, [], provider);
    expect(out).toHaveLength(0);
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
});
