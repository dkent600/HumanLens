import { describe, expect, it } from 'vitest';
import { ObjectiveLens } from '../src/engine/lenses/objective-lens.js';
import {
  FakeLlmProvider,
  type LensPromptPayload,
  type LensResponsePayload,
} from '../src/seams/llm-provider.js';
import { isEvidenceAnchored, makeOrdinaryFinding, type Finding } from '../src/domain/finding.js';
import type { Unit } from '../src/domain/types.js';

// The Inclusity Objective Lens is the first lens in the Interpret layer. Beyond the
// established "reads prior findings, anchors to units" pattern, it proves the deeper
// dependency: its real input is the AGGREGATE layer's output, so its findings depend
// on an Aggregate (tension/culture) finding being present and anchor to the units
// behind it — the analog of the test that proved Discernment saw Aggregate output.

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

function finding(lens: 'listening' | 'tension', findingId: string, links: readonly string[]): Finding {
  return makeOrdinaryFinding({ findingId, lens, content: `a ${lens} finding`, evidenceLinks: links, units });
}

describe('Inclusity Objective lens — Interpret layer, reads Aggregate output', () => {
  it('stays silent when there is nothing to interpret', async () => {
    const out = await new ObjectiveLens().run(units, [], new FakeLlmProvider());
    expect(out).toHaveLength(0);
  });

  it('reads the Aggregate output: its finding depends on the tension finding and anchors to the units behind it', async () => {
    // The Evidence finding anchors u1; the Aggregate (tension) finding anchors u2,u3.
    const evidence = finding('listening', 'listening:0', ['u1']);
    const aggregate = finding('tension', 'tension:0', ['u2', 'u3']);

    // With Evidence alone, the interpretation reaches only u1.
    const evidenceOnly = await new ObjectiveLens().run(units, [evidence], new FakeLlmProvider());
    expect([...evidenceOnly[0]!.evidenceLinks].sort()).toEqual(['u1']);

    // Add the Aggregate finding: the interpretation now reaches u2,u3 too. The added
    // anchors come solely from the tension finding — so the output provably depends
    // on the Aggregate-level output, anchored back to the units behind it.
    const withAggregate = await new ObjectiveLens().run(units, [evidence, aggregate], new FakeLlmProvider());
    const objective = withAggregate[0]!;
    expect(objective.lens).toBe('objective');
    expect(objective.findingId).toBe('objective:0');
    expect(isEvidenceAnchored(objective)).toBe(true);
    expect([...objective.evidenceLinks].sort()).toEqual(['u1', 'u2', 'u3']);
    expect(objective.supportSet).toEqual({ sourceCount: 3, unitCount: 3 });
    expect(objective.clearedToClientSafe).toBe(false); // held by default
  });

  it('threads the objective frame and the prior findings to the provider', async () => {
    let seen: LensPromptPayload | undefined;
    const spy = new FakeLlmProvider((payload): LensResponsePayload => {
      seen = payload;
      return { findings: [] };
    });
    await new ObjectiveLens().run(units, [finding('tension', 'tension:0', ['u1'])], spy);

    // The Interpret layer carries the (placeholder) objective frame structurally...
    expect(seen?.objectiveFrame).toEqual({ surveyDomains: [], adkarDimensions: [] });
    // ...and the prior findings it interprets.
    expect(seen?.priorFindings?.map((f) => f.findingId)).toEqual(['tension:0']);
  });

  it('enforces anchoring on interpretive output — drops an interpretation with no in-scope anchor', async () => {
    const rogue = new FakeLlmProvider(
      (): LensResponsePayload => ({
        findings: [{ content: 'an ungrounded implication', evidenceUnitIds: ['not-in-scope'] }],
      }),
    );
    const out = await new ObjectiveLens().run(units, [finding('tension', 'tension:0', ['u1'])], rogue);
    expect(out).toHaveLength(0);
  });

  it('is deterministic — same prior findings yield the same output', async () => {
    const prior = [finding('tension', 'tension:0', ['u1', 'u2'])];
    const a = await new ObjectiveLens().run(units, prior, new FakeLlmProvider());
    const b = await new ObjectiveLens().run(units, prior, new FakeLlmProvider());
    expect(a).toEqual(b);
  });
});
