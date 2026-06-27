import { describe, expect, it } from 'vitest';
import { DiscernmentLens } from '../src/engine/lenses/discernment-lens.js';
import { assembleBrief } from '../src/engine/assemble.js';
import {
  FakeLlmProvider,
  type DiscernmentResponsePayload,
} from '../src/seams/llm-provider.js';
import { isEvidenceAnchored, makeOrdinaryFinding, type Finding } from '../src/domain/finding.js';
import type { Unit } from '../src/domain/types.js';

// Discernment is the Guardrail-layer auditor: the real, affirmative promoter of
// findings to the client-safe layer and the setter of sensitivity. It does not
// mutate prior findings — it returns revisions rebuilt through the factory that
// reuse the prior finding_id (so the Guardrail stage supersedes them in place),
// with support re-derived from the unchanged evidence.

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

function priorFinding(findingId: string, evidenceLinks: readonly string[]): Finding {
  return makeOrdinaryFinding({
    findingId,
    lens: 'tension',
    verbatim: 'a prior finding',
    evidenceLinks,
    units,
  });
}

/** A fake whose disposition response is a fixed set of verdicts. */
function verdicts(response: DiscernmentResponsePayload): FakeLlmProvider {
  return new FakeLlmProvider(() => response);
}

describe('Discernment lens — Guardrail audit, the real promoter', () => {
  it('stays silent when there are no prior findings to audit', async () => {
    const out = await new DiscernmentLens().run(units, [], new FakeLlmProvider());
    expect(out).toHaveLength(0);
  });

  it('promotes a named finding — rebuilt through the factory, support honest and links preserved', async () => {
    const prior = [priorFinding('tension:0', ['u1', 'u2'])];
    const provider = verdicts({ verdicts: [{ findingId: 'tension:0', promote: true }] });

    const [revised] = await new DiscernmentLens().run(units, prior, provider);

    expect(revised.findingId).toBe('tension:0'); // same id -> supersedes in the pipeline
    expect(revised.clearedToClientSafe).toBe(true);
    expect(revised.sensitivity).toBe('normal');
    expect(isEvidenceAnchored(revised)).toBe(true);
    expect([...revised.evidenceLinks].sort()).toEqual(['u1', 'u2']); // links preserved
    expect(revised.supportSet).toEqual({ sourceCount: 2, unitCount: 2 }); // re-derived, unchanged
  });

  it('flags a finding sensitive — held at Assemble even when also promoted', async () => {
    const prior = [priorFinding('tension:0', ['u1', 'u2'])];
    const provider = verdicts({
      verdicts: [{ findingId: 'tension:0', promote: true, sensitive: true }],
    });

    const revised = await new DiscernmentLens().run(units, prior, provider);
    expect(revised[0]?.sensitivity).toBe('sensitive');
    expect(revised[0]?.clearedToClientSafe).toBe(true);

    // The sensitivity backstop holds: promoted but sensitive -> absent from client-safe.
    const brief = assembleBrief('eng:1', revised);
    expect(brief.clientSafe).toHaveLength(0);
  });

  it('revises only the findings it names — others are left untouched (held by default)', async () => {
    const prior = [priorFinding('listening:0', ['u1']), priorFinding('tension:0', ['u1', 'u2'])];
    const provider = verdicts({ verdicts: [{ findingId: 'tension:0', promote: true }] });

    const revised = await new DiscernmentLens().run(units, prior, provider);

    // Discernment returns a revision ONLY for the named finding; listening:0 is not
    // emitted, so it keeps its held disposition in the pipeline accumulator.
    expect(revised.map((f) => f.findingId)).toEqual(['tension:0']);
  });

  it('ignores a verdict for a finding id not in scope', async () => {
    const prior = [priorFinding('tension:0', ['u1', 'u2'])];
    const provider = verdicts({ verdicts: [{ findingId: 'no-such-finding', promote: true }] });

    const out = await new DiscernmentLens().run(units, prior, provider);
    expect(out).toHaveLength(0); // a verdict cannot conjure a finding
  });

  it('default fake promotes nothing — held-by-default stands (silence, not exposure)', async () => {
    const prior = [priorFinding('tension:0', ['u1', 'u2'])];
    const out = await new DiscernmentLens().run(units, prior, new FakeLlmProvider());
    expect(out).toHaveLength(0);
  });
});
