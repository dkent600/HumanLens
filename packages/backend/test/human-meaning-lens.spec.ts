import { describe, expect, it } from 'vitest';
import { HumanMeaningLens } from '../src/engine/lenses/human-meaning-lens.js';
import { FakeLlmProvider, type LensResponsePayload } from '../src/seams/llm-provider.js';
import { isEvidenceAnchored } from '../src/domain/finding.js';
import type { Unit } from '../src/domain/types.js';

// The Human Meaning lens is the Evidence-layer sibling of Listening: it reads the
// cleared units directly and emits findings anchored to them. (Its independence from
// Listening — same units, neither sees the other — is proven in lens-pipeline.spec.)

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

describe('Human Meaning lens — Evidence layer, reads units directly', () => {
  it('is silent when there are no units', async () => {
    const out = await new HumanMeaningLens().run([], [], new FakeLlmProvider());
    expect(out).toHaveLength(0);
  });

  it('emits a finding anchored to the units it read, held by default', async () => {
    const out = await new HumanMeaningLens().run(units, [], new FakeLlmProvider());

    expect(out).toHaveLength(1);
    const [meaning] = out;
    expect(meaning.lens).toBe('meaning');
    expect(meaning.findingId).toBe('meaning:0');
    expect(isEvidenceAnchored(meaning)).toBe(true);
    expect([...meaning.evidenceLinks].sort()).toEqual(['u1', 'u2']);
    expect(meaning.supportSet).toEqual({ sourceCount: 2, unitCount: 2 }); // derived, honest
    expect(meaning.clearedToClientSafe).toBe(false); // held by default
  });

  it('drops a finding whose only anchor is out of scope', async () => {
    const rogue = new FakeLlmProvider(
      (): LensResponsePayload => ({
        findings: [{ content: 'an ungrounded meaning', evidenceUnitIds: ['not-in-scope'] }],
      }),
    );
    const out = await new HumanMeaningLens().run(units, [], rogue);
    expect(out).toHaveLength(0);
  });

  it('is deterministic — same units yield the same finding', async () => {
    const a = await new HumanMeaningLens().run(units, [], new FakeLlmProvider());
    const b = await new HumanMeaningLens().run(units, [], new FakeLlmProvider());
    expect(a).toEqual(b);
  });
});
