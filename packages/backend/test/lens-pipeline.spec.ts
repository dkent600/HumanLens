import { describe, expect, it } from 'vitest';
import { DeidGate } from '../src/engine/deid-gate.js';
import { LensPipeline } from '../src/engine/lens-pipeline.js';
import { ListeningLens } from '../src/engine/lenses/listening-lens.js';
import { TensionLens } from '../src/engine/lenses/tension-lens.js';
import { CulturePatternLens } from '../src/engine/lenses/culture-pattern-lens.js';
import { DiscernmentLens } from '../src/engine/lenses/discernment-lens.js';
import { InMemoryUnitRepository, type Scope } from '../src/seams/repository.js';
import { TrivialDeidDetector } from '../src/seams/deid-detector.js';
import { FakeLlmProvider, defaultFakeResponse } from '../src/seams/llm-provider.js';
import { isEvidenceAnchored } from '../src/domain/finding.js';
import type { Actor, Unit } from '../src/domain/types.js';

/**
 * A fake that drives the emit lenses normally (delegating to the default) but
 * scripts the Discernment audit: it promotes / flags the named finding ids.
 */
function promotingProvider(
  promote: readonly string[],
  sensitive: readonly string[] = [],
): FakeLlmProvider {
  return new FakeLlmProvider((payload) => {
    if (payload.task === 'disposition') {
      return {
        verdicts: (payload.priorFindings ?? [])
          .filter((f) => promote.includes(f.findingId) || sensitive.includes(f.findingId))
          .map((f) => ({
            findingId: f.findingId,
            promote: promote.includes(f.findingId),
            sensitive: sensitive.includes(f.findingId),
          })),
      };
    }
    return defaultFakeResponse(payload);
  });
}

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

  it('completes the projection path once REAL Discernment affirmatively promotes a finding', async () => {
    const { gate } = await clearedScopeWithUnits();
    // Discernment (Guardrail) is the affirmative promoter now — not a test helper.
    const provider = promotingProvider(['listening:0']);
    const brief = await new LensPipeline(gate, provider, [
      new ListeningLens(),
      new DiscernmentLens(),
    ]).synthesize(scope);

    expect(brief.clientSafe).toHaveLength(1);
    const [cs] = brief.clientSafe;
    expect(cs.findingId).toBe('listening:0');
    expect([...cs.evidenceLinks].sort()).toEqual(['u1', 'u2']); // traceability preserved
    expect(cs.support).toEqual({ sourceCount: 2, unitCount: 2 });

    // The projection carries no internal-only gating field.
    expect(cs).not.toHaveProperty('clearedToClientSafe');
    expect(cs).not.toHaveProperty('sensitivity');

    // client-safe ⊆ internal: the promoted finding is the same id, present internally
    // and there marked cleared (revised in place — no duplicate appended).
    expect(brief.internal.map((f) => f.findingId)).toEqual(['listening:0']);
    expect(brief.internal[0]?.clearedToClientSafe).toBe(true);
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

  it('runs the two Aggregate siblings against the same Evidence snapshot — neither sees the other', async () => {
    const { gate } = await clearedScopeWithUnits();

    // Record the prior-finding ids each Aggregate emit call was handed.
    const seenPriorIds: string[][] = [];
    const spy = new FakeLlmProvider((payload) => {
      if (payload.task !== 'disposition' && (payload.priorFindings?.length ?? 0) > 0) {
        seenPriorIds.push((payload.priorFindings ?? []).map((f) => f.findingId));
      }
      return defaultFakeResponse(payload);
    });

    const brief = await new LensPipeline(gate, spy, [
      new ListeningLens(),
      new TensionLens(),
      new CulturePatternLens(),
    ]).synthesize(scope);

    // Both Aggregate lenses ran, each over the SAME Evidence-only snapshot — neither
    // saw the other's output (no 'tension:0' in culture's view, no 'culture:0' in
    // tension's). The snapshot-per-layer semantics keep them independent.
    expect(seenPriorIds).toEqual([['listening:0'], ['listening:0']]);

    // Both produced an Aggregate finding anchored to the same Evidence units.
    expect(brief.internal.map((f) => f.findingId)).toEqual(['listening:0', 'tension:0', 'culture:0']);
    const tension = brief.internal.find((f) => f.findingId === 'tension:0');
    const culture = brief.internal.find((f) => f.findingId === 'culture:0');
    expect([...(tension?.evidenceLinks ?? [])].sort()).toEqual(['u1', 'u2']);
    expect([...(culture?.evidenceLinks ?? [])].sort()).toEqual(['u1', 'u2']);
  });
});

describe('lens pipeline — staged with Guardrail (real Discernment disposition)', () => {
  function fullPipeline(gate: DeidGate, provider: FakeLlmProvider): LensPipeline {
    return new LensPipeline(gate, provider, [
      new ListeningLens(),
      new TensionLens(),
      new DiscernmentLens(),
    ]);
  }

  it('holds everything by default when Discernment promotes nothing', async () => {
    const { gate } = await clearedScopeWithUnits();
    // The default fake's disposition response is empty verdicts — silence.
    const brief = await fullPipeline(gate, new FakeLlmProvider()).synthesize(scope);

    expect(brief.internal.map((f) => f.findingId)).toEqual(['listening:0', 'tension:0']);
    expect(brief.internal.every((f) => f.clearedToClientSafe === false)).toBe(true);
    expect(brief.clientSafe).toHaveLength(0);
  });

  it('Discernment runs after Evidence and Aggregate and sees their findings', async () => {
    const { gate } = await clearedScopeWithUnits();
    // tension:0 exists only because the Aggregate lens ran before Guardrail; that
    // Discernment can promote it proves it audited the accumulated Aggregate output.
    const brief = await fullPipeline(gate, promotingProvider(['tension:0'])).synthesize(scope);

    expect(brief.internal.map((f) => f.findingId)).toEqual(['listening:0', 'tension:0']); // revised in place
    expect(brief.clientSafe.map((f) => f.findingId)).toEqual(['tension:0']);

    // client-safe ⊆ internal, end to end: every client-safe id is present internally.
    const internalIds = new Set(brief.internal.map((f) => f.findingId));
    expect(brief.clientSafe.every((f) => internalIds.has(f.findingId))).toBe(true);
  });

  it('keeps a promoted-but-sensitive finding out of the client-safe layer (backstop holds)', async () => {
    const { gate } = await clearedScopeWithUnits();
    // Promote BOTH, but flag listening:0 sensitive — it must not cross over.
    const provider = promotingProvider(['listening:0', 'tension:0'], ['listening:0']);
    const brief = await fullPipeline(gate, provider).synthesize(scope);

    const sensitive = brief.internal.find((f) => f.findingId === 'listening:0');
    expect(sensitive?.sensitivity).toBe('sensitive');
    expect(sensitive?.clearedToClientSafe).toBe(true); // promoted...
    expect(brief.clientSafe.map((f) => f.findingId)).toEqual(['tension:0']); // ...but held
  });

  it('is deterministic — same input and verdicts yield the same brief', async () => {
    const a = await clearedScopeWithUnits();
    const b = await clearedScopeWithUnits();
    const briefA = await fullPipeline(a.gate, promotingProvider(['tension:0'])).synthesize(scope);
    const briefB = await fullPipeline(b.gate, promotingProvider(['tension:0'])).synthesize(scope);
    expect(briefA).toEqual(briefB);
  });
});
