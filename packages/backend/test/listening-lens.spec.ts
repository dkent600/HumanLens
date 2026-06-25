import { describe, expect, it } from 'vitest';
import { ListeningLens } from '../src/engine/lenses/listening-lens.js';
import { FakeLlmProvider, type LensResponsePayload } from '../src/seams/llm-provider.js';
import { isEvidenceAnchored } from '../src/domain/finding.js';
import type { Unit } from '../src/domain/types.js';

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
        findings: [{ content: 'an ungrounded theme', evidenceUnitIds: ['not-in-scope'] }],
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
