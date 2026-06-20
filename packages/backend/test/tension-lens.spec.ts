import { describe, expect, it } from 'vitest';
import { TensionLens } from '../src/engine/lenses/tension-lens.js';
import {
  FakeLlmProvider,
  type LensPromptPayload,
  type LensResponsePayload,
} from '../src/seams/llm-provider.js';
import { isEvidenceAnchored, makeOrdinaryFinding, type Finding } from '../src/domain/finding.js';
import type { Unit } from '../src/domain/types.js';

// The Tension lens proves two things the Evidence lens cannot, because it is the
// first lens that reads PRIOR findings: (1) a later stage actually receives the
// prior findings, not just units; (2) evidence anchoring is enforced on
// interpretive output too — a tension with no in-scope unit anchor never escapes.

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

/** An Evidence-layer finding to feed the Tension lens as prior input. */
function evidenceFinding(findingId: string, evidenceLinks: readonly string[]): Finding {
  return makeOrdinaryFinding({
    findingId,
    lens: 'listening',
    content: 'an evidence-layer theme',
    evidenceLinks,
    units,
  });
}

describe('Tension lens — Aggregate layer, reads prior findings', () => {
  it('stays silent when there are no prior findings to synthesize from', async () => {
    const out = await new TensionLens().run(units, [], new FakeLlmProvider());
    expect(out).toHaveLength(0);
  });

  it('anchors to the units BEHIND the prior findings — it read findings, not just units', async () => {
    // The Evidence finding cites only u1 + u2 (not u3). The default fake follows the
    // prior findings back to THEIR units, so the tension must anchor to u1,u2 only.
    // If the lens were reading units directly it would reach u3 too — this
    // distinguishes "read prior findings" from "read all the units".
    const prior = [evidenceFinding('listening:0', ['u1', 'u2'])];
    const out = await new TensionLens().run(units, prior, new FakeLlmProvider());

    expect(out).toHaveLength(1);
    const [tension] = out;
    expect(tension.lens).toBe('tension');
    expect(tension.findingId).toBe('tension:0');
    expect(isEvidenceAnchored(tension)).toBe(true);
    expect([...tension.evidenceLinks].sort()).toEqual(['u1', 'u2']); // NOT u3
    expect(tension.supportSet).toEqual({ sourceCount: 2, unitCount: 2 });
    expect(tension.clearedToClientSafe).toBe(false); // still held by default
  });

  it('passes the prior findings to the provider (the stage receives findings, not just units)', async () => {
    let seen: LensPromptPayload | undefined;
    const spy = new FakeLlmProvider((payload): LensResponsePayload => {
      seen = payload;
      return { findings: [] };
    });
    const prior = [evidenceFinding('listening:0', ['u1', 'u2'])];
    await new TensionLens().run(units, prior, spy);

    expect(seen?.priorFindings?.map((f) => f.findingId)).toEqual(['listening:0']);
    expect(seen?.priorFindings?.[0]?.evidenceUnitIds).toEqual(['u1', 'u2']);
  });

  it('enforces anchoring on interpretive output — drops a tension with no in-scope unit anchor', async () => {
    // A model that cites a unit id not in this run's cleared set. Even though a prior
    // finding exists, an unanchored interpretive finding is a defect, never asserted.
    const rogue = new FakeLlmProvider(
      (): LensResponsePayload => ({
        findings: [{ content: 'an ungrounded tension', evidenceUnitIds: ['not-in-scope'] }],
      }),
    );
    const prior = [evidenceFinding('listening:0', ['u1'])];
    const out = await new TensionLens().run(units, prior, rogue);
    expect(out).toHaveLength(0);
  });
});
