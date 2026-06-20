import { describe, expect, it } from 'vitest';
import { OpeningLens } from '../src/engine/lenses/opening-lens.js';
import {
  FakeLlmProvider,
  type LensPromptPayload,
  type LensResponsePayload,
} from '../src/seams/llm-provider.js';
import { isEvidenceAnchored, makeOrdinaryFinding, type Finding } from '../src/domain/finding.js';
import type { Unit } from '../src/domain/types.js';

// The Action Opening lens is the single lens of the terminal Openings layer. It
// follows the established "reads prior findings, anchors to units" pattern. Its
// distinguishing property — that it runs after Discernment and is therefore never
// auto-promoted (held internal-only) — is proven end-to-end in lens-pipeline.spec.

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

/** A prior finding to feed the Opening lens (its layer is irrelevant to this lens). */
function priorFinding(findingId: string, evidenceLinks: readonly string[]): Finding {
  return makeOrdinaryFinding({
    findingId,
    lens: 'objective',
    content: 'a prior finding',
    evidenceLinks,
    units,
  });
}

describe('Action Opening lens — Openings layer, reads the audited picture', () => {
  it('stays silent when there are no prior findings to build on', async () => {
    const out = await new OpeningLens().run(units, [], new FakeLlmProvider());
    expect(out).toHaveLength(0);
  });

  it('anchors openings to the units BEHIND the prior findings', async () => {
    // The prior finding cites only u1 + u2 (not u3); the opening must anchor to those.
    const prior = [priorFinding('objective:0', ['u1', 'u2'])];
    const out = await new OpeningLens().run(units, prior, new FakeLlmProvider());

    expect(out).toHaveLength(1);
    const [opening] = out;
    expect(opening.lens).toBe('opening');
    expect(opening.findingId).toBe('opening:0');
    expect(isEvidenceAnchored(opening)).toBe(true);
    expect([...opening.evidenceLinks].sort()).toEqual(['u1', 'u2']); // NOT u3
    expect(opening.supportSet).toEqual({ sourceCount: 2, unitCount: 2 });
    expect(opening.clearedToClientSafe).toBe(false); // held by default (its promoter is human review)
  });

  it('passes the prior findings to the provider (the stage receives findings, not just units)', async () => {
    let seen: LensPromptPayload | undefined;
    const spy = new FakeLlmProvider((payload): LensResponsePayload => {
      seen = payload;
      return { findings: [] };
    });
    await new OpeningLens().run(units, [priorFinding('objective:0', ['u1', 'u2'])], spy);

    expect(seen?.priorFindings?.map((f) => f.findingId)).toEqual(['objective:0']);
    expect(seen?.priorFindings?.[0]?.evidenceUnitIds).toEqual(['u1', 'u2']);
  });

  it('enforces anchoring on its output — drops an opening with no in-scope unit anchor', async () => {
    const rogue = new FakeLlmProvider(
      (): LensResponsePayload => ({
        findings: [{ content: 'an ungrounded next step', evidenceUnitIds: ['not-in-scope'] }],
      }),
    );
    const out = await new OpeningLens().run(units, [priorFinding('objective:0', ['u1'])], rogue);
    expect(out).toHaveLength(0);
  });

  it('is deterministic — same prior findings yield the same output', async () => {
    const prior = [priorFinding('objective:0', ['u1', 'u2'])];
    const a = await new OpeningLens().run(units, prior, new FakeLlmProvider());
    const b = await new OpeningLens().run(units, prior, new FakeLlmProvider());
    expect(a).toEqual(b);
  });
});
