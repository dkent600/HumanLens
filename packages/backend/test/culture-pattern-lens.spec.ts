import { describe, expect, it } from 'vitest';
import { CulturePatternLens } from '../src/engine/lenses/culture-pattern-lens.js';
import {
  FakeLlmProvider,
  type LensPromptPayload,
  type LensResponsePayload,
} from '../src/seams/llm-provider.js';
import { isEvidenceAnchored, makeOrdinaryFinding, type Finding } from '../src/domain/finding.js';
import type { Unit } from '../src/domain/types.js';

// The Culture Pattern lens is the Aggregate-wave sibling of the Tension lens, so it
// proves the same properties: it reads PRIOR (Evidence) findings, and anchors its
// pattern to the units BEHIND them — interpretive output stays evidence-anchored.

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

const units: readonly Unit[] = [
  clearedUnit('u1', 'spk-a'),
  clearedUnit('u2', 'spk-b'),
  clearedUnit('u3', 'spk-c'),
];

/** An Evidence-wave finding to feed the Culture Pattern lens as prior input. */
function evidenceFinding(findingId: string, evidenceLinks: readonly string[]): Finding {
  return makeOrdinaryFinding({
    findingId,
    lens: 'listening',
    verbatim: 'an evidence-wave theme',
    evidenceLinks,
    units,
  });
}

describe('Culture Pattern lens — Aggregate wave, reads prior findings', () => {
  it('stays silent when there are no prior findings to synthesize from', async () => {
    const out = await new CulturePatternLens().run(units, [], new FakeLlmProvider());
    expect(out).toHaveLength(0);
  });

  it('anchors to the units BEHIND the prior findings — it read findings, not just units', async () => {
    // The Evidence finding cites only u1 + u2 (not u3). The default fake follows the
    // prior findings back to THEIR units, so the pattern must anchor to u1,u2 only.
    const prior = [evidenceFinding('listening:0', ['u1', 'u2'])];
    const out = await new CulturePatternLens().run(units, prior, new FakeLlmProvider());

    expect(out).toHaveLength(1);
    const [pattern] = out;
    expect(pattern.lens).toBe('culture');
    expect(pattern.findingId).toBe('culture:0');
    expect(isEvidenceAnchored(pattern)).toBe(true);
    expect([...pattern.evidenceLinks].sort()).toEqual(['u1', 'u2']); // NOT u3
    expect(pattern.supportSet).toEqual({ sourceCount: 2, unitCount: 2 });
    expect(pattern.clearedToClientSafe).toBe(false); // still held by default
  });

  it('passes the prior findings to the provider (the stage receives findings, not just units)', async () => {
    let seen: LensPromptPayload | undefined;
    const spy = new FakeLlmProvider((payload): LensResponsePayload => {
      seen = payload;
      return { findings: [] };
    });
    const prior = [evidenceFinding('listening:0', ['u1', 'u2'])];
    await new CulturePatternLens().run(units, prior, spy);

    expect(seen?.priorFindings?.map((f) => f.findingId)).toEqual(['listening:0']);
    expect(seen?.priorFindings?.[0]?.evidenceUnitIds).toEqual(['u1', 'u2']);
  });

  it('enforces anchoring on interpretive output — drops a pattern with no in-scope unit anchor', async () => {
    // A model that cites a unit id not in this run's cleared set. Even with a prior
    // finding present, an unanchored interpretive finding is a defect, never asserted.
    const rogue = new FakeLlmProvider(
      (): LensResponsePayload => ({
        findings: [{ noticing: 'an ungrounded pattern', evidenceUnitIds: ['not-in-scope'] }],
      }),
    );
    const prior = [evidenceFinding('listening:0', ['u1'])];
    const out = await new CulturePatternLens().run(units, prior, rogue);
    expect(out).toHaveLength(0);
  });

  it('is deterministic — same prior findings yield the same output', async () => {
    const prior = [evidenceFinding('listening:0', ['u1', 'u2'])];
    const a = await new CulturePatternLens().run(units, prior, new FakeLlmProvider());
    const b = await new CulturePatternLens().run(units, prior, new FakeLlmProvider());
    expect(a).toEqual(b);
  });
});
