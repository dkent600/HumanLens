import { describe, expect, it } from 'vitest';
import { DeidGate } from '../src/engine/deid-gate.js';
import { LensPipeline } from '../src/engine/lens-pipeline.js';
import { ListeningLens } from '../src/engine/lenses/listening-lens.js';
import { TensionLens } from '../src/engine/lenses/tension-lens.js';
import { assembleBrief, projectToClientSafe } from '../src/engine/assemble.js';
import { InMemoryUnitRepository, type Scope } from '../src/seams/repository.js';
import { TrivialDeidDetector } from '../src/seams/deid-detector.js';
import { FakeLlmProvider } from '../src/seams/llm-provider.js';
import {
  isEvidenceAnchored,
  makeOrdinaryFinding,
  type Finding,
} from '../src/domain/finding.js';
import type { Actor, Unit } from '../src/domain/types.js';

// End-to-end proof of the slice's spine, with the model stubbed:
//   gate.clearedUnitsForLenses -> Listening lens (via the provider seam)
//   -> evidence-anchored findings -> Assemble -> client-safe projection.

const actor: Actor = { id: 'actor:test' };
const scope: Scope = { engagementId: 'eng:1', actor };

function pendingUnit(unitId: string, speakerToken: string, content: string): Unit {
  return {
    unitId,
    engagementId: 'will-be-stamped',
    ingestedBy: 'will-be-stamped',
    ingestedAt: '2026-01-01T00:00:00.000Z',
    sourceRef: 'src',
    position: 0,
    language: 'en',
    content,
    deidStatus: 'pending',
    speakerToken,
  };
}

async function clearedScopeWithUnits(): Promise<{ gate: DeidGate; units: readonly Unit[] }> {
  const repo = new InMemoryUnitRepository();
  await repo.saveUnit(scope, pendingUnit('u1', 'spk-a', 'workload has been heavy lately'));
  await repo.saveUnit(scope, pendingUnit('u2', 'spk-b', 'workload is unsustainable'));
  const gate = new DeidGate(new TrivialDeidDetector(), repo);
  await gate.scanPending(scope); // clear them through the gate
  return { gate, units: await gate.clearedUnitsForLenses(scope) };
}

function pipeline(gate: DeidGate): LensPipeline {
  return new LensPipeline(gate, new FakeLlmProvider(), [new ListeningLens()]);
}

describe('lens pipeline — the spine, model stubbed', () => {
  it('turns cleared units into evidence-anchored findings, held by default', async () => {
    const { gate } = await clearedScopeWithUnits();
    const brief = await pipeline(gate).synthesize(scope);

    // One Evidence-layer finding, anchored to both cleared units across two sources.
    expect(brief.internal).toHaveLength(1);
    const [found] = brief.internal;
    expect(found.findingId).toBe('listening:0');
    expect(found.lens).toBe('listening');
    expect(isEvidenceAnchored(found)).toBe(true);
    expect([...found.evidenceLinks].sort()).toEqual(['u1', 'u2']);
    expect(found.supportSet).toEqual({ sourceCount: 2, unitCount: 2 });

    // Held by default: nothing reaches the client-safe layer without promotion.
    expect(brief.clientSafe).toHaveLength(0);
  });

  it('never lets units that did not clear the gate reach the lenses', async () => {
    const repo = new InMemoryUnitRepository();
    await repo.saveUnit(scope, pendingUnit('u1', 'spk-a', 'a comment')); // left pending
    const gate = new DeidGate(new TrivialDeidDetector(), repo);

    const brief = await pipeline(gate).synthesize(scope);
    expect(brief.internal).toHaveLength(0); // no cleared units -> no findings
  });

  it('is deterministic — same cleared units yield the same findings', async () => {
    const a = await clearedScopeWithUnits();
    const b = await clearedScopeWithUnits();
    const briefA = await pipeline(a.gate).synthesize(scope);
    const briefB = await pipeline(b.gate).synthesize(scope);
    expect(briefA.internal).toEqual(briefB.internal);
  });

  it('completes the projection path once a finding is affirmatively promoted', async () => {
    const { gate, units } = await clearedScopeWithUnits();
    const brief = await pipeline(gate).synthesize(scope);

    // Promotion is the affirmative act the Discernment lens / human review will own;
    // here the test performs it to exercise the projection end-to-end.
    const promoted = brief.internal.map((f) => promote(f, units));
    const projectedBrief = assembleBrief(scope.engagementId, promoted);

    expect(projectedBrief.clientSafe).toHaveLength(1);
    const [cs] = projectedBrief.clientSafe;
    expect(cs.findingId).toBe('listening:0');
    expect([...cs.evidenceLinks].sort()).toEqual(['u1', 'u2']); // traceability preserved
    expect(cs.support).toEqual({ sourceCount: 2, unitCount: 2 });

    // And the projection itself carries no internal-only gating field.
    const direct = projectToClientSafe(promoted[0]);
    expect(direct).not.toHaveProperty('clearedToClientSafe');
    expect(direct).not.toHaveProperty('sensitivity');
  });
});

describe('lens pipeline — staged: Evidence → Aggregate', () => {
  function stagedPipeline(gate: DeidGate): LensPipeline {
    return new LensPipeline(gate, new FakeLlmProvider(), [new ListeningLens(), new TensionLens()]);
  }

  it('runs layers in order and accumulates prior-stage findings into later stages', async () => {
    const { gate } = await clearedScopeWithUnits();
    const brief = await stagedPipeline(gate).synthesize(scope);

    // Both stages produced findings; they accumulate, Evidence before Aggregate.
    expect(brief.internal.map((f) => f.findingId)).toEqual(['listening:0', 'tension:0']);
    const [listening, tension] = brief.internal;
    expect(listening.lens).toBe('listening');
    expect(tension.lens).toBe('tension');

    // The Aggregate lens read the Evidence finding and anchored its tension to the
    // units behind it — interpretive output is still evidence-anchored.
    expect(isEvidenceAnchored(tension)).toBe(true);
    expect([...tension.evidenceLinks].sort()).toEqual(['u1', 'u2']);
    expect(tension.supportSet).toEqual({ sourceCount: 2, unitCount: 2 });

    // Still held by default — promotion is not a lens concern at this stage.
    expect(brief.clientSafe).toHaveLength(0);
  });

  it('the deterministic fake drives both lenses reproducibly', async () => {
    const a = await clearedScopeWithUnits();
    const b = await clearedScopeWithUnits();
    const briefA = await stagedPipeline(a.gate).synthesize(scope);
    const briefB = await stagedPipeline(b.gate).synthesize(scope);
    expect(briefA.internal).toEqual(briefB.internal);
  });

  it('produces no Aggregate findings when the Evidence layer found nothing to build on', async () => {
    // No cleared units -> no Evidence findings -> the Aggregate lens has no prior
    // findings to synthesize from, so the stage stays silent rather than straining.
    const repo = new InMemoryUnitRepository();
    await repo.saveUnit(scope, pendingUnit('u1', 'spk-a', 'a comment')); // left pending
    const gate = new DeidGate(new TrivialDeidDetector(), repo);

    const brief = await stagedPipeline(gate).synthesize(scope);
    expect(brief.internal).toHaveLength(0);
  });
});

/** Rebuild a finding as affirmatively promoted (the only lens here emits ordinary findings). */
function promote(f: Finding, units: readonly Unit[]): Finding {
  if (f.findingKind === 'absence') {
    return f; // not produced by the Listening lens; left untouched for completeness
  }
  return makeOrdinaryFinding({
    findingId: f.findingId,
    lens: f.lens,
    content: f.content,
    evidenceLinks: f.evidenceLinks,
    units,
    sensitivity: f.sensitivity,
    clearedToClientSafe: true,
    parent: f.parent,
  });
}
