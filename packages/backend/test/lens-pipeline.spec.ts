import { describe, expect, it } from 'vitest';
import { DeidGate } from '../src/engine/deid-gate.js';
import { LensPipeline } from '../src/engine/lens-pipeline.js';
import { ListeningLens } from '../src/engine/lenses/listening-lens.js';
import { HumanMeaningLens } from '../src/engine/lenses/human-meaning-lens.js';
import { TensionLens } from '../src/engine/lenses/tension-lens.js';
import { CulturePatternLens } from '../src/engine/lenses/culture-pattern-lens.js';
import { ObjectiveLens } from '../src/engine/lenses/objective-lens.js';
import { DiscernmentLens } from '../src/engine/lenses/discernment-lens.js';
import { OpeningLens } from '../src/engine/lenses/opening-lens.js';
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

    // Per-voice fan-out: one Evidence finding PER unit, each anchored to its single unit
    // (cross-source support is now the Aggregate lenses' business, not Listening's).
    expect(brief.internal.map((f) => f.findingId)).toEqual(['listening:0-0', 'listening:1-0']);
    for (const f of brief.internal) {
      expect(f.lens).toBe('listening');
      expect(isEvidenceAnchored(f)).toBe(true);
      expect(f.supportSet).toEqual({ sourceCount: 1, unitCount: 1 });
    }
    expect([...brief.internal[0].evidenceLinks]).toEqual(['u1']);
    expect([...brief.internal[1].evidenceLinks]).toEqual(['u2']);

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
    const provider = promotingProvider(['listening:0-0']);
    const brief = await new LensPipeline(gate, provider, [
      new ListeningLens(),
      new DiscernmentLens(),
    ]).synthesize(scope);

    expect(brief.clientSafe).toHaveLength(1);
    const [cs] = brief.clientSafe;
    expect(cs.findingId).toBe('listening:0-0');
    expect([...cs.evidenceLinks]).toEqual(['u1']); // traceability preserved (per-voice: one unit)
    expect(cs.support).toEqual({ sourceCount: 1, unitCount: 1 });

    // The projection carries no internal-only gating field.
    expect(cs).not.toHaveProperty('clearedToClientSafe');
    expect(cs).not.toHaveProperty('sensitivity');

    // client-safe ⊆ internal: the promoted finding is the same id, present internally
    // and there marked cleared (revised in place); the other voice stays held.
    expect(brief.internal.map((f) => f.findingId)).toEqual(['listening:0-0', 'listening:1-0']);
    expect(brief.internal.find((f) => f.findingId === 'listening:0-0')?.clearedToClientSafe).toBe(true);
    expect(brief.internal.find((f) => f.findingId === 'listening:1-0')?.clearedToClientSafe).toBe(false);
  });
});

describe('lens pipeline — staged waves: accumulation + snapshot-per-wave independence', () => {
  function stagedPipeline(gate: DeidGate): LensPipeline {
    return new LensPipeline(gate, new FakeLlmProvider(), [new ListeningLens(), new TensionLens()]);
  }

  it('runs waves in order and accumulates prior-stage findings into later stages', async () => {
    const { gate } = await clearedScopeWithUnits();
    const brief = await stagedPipeline(gate).synthesize(scope);

    // Both stages produced findings; they accumulate, Evidence before Interpret. Evidence
    // is per-voice (one finding per unit); Tension (Interpret) is batched — it reads the
    // whole prior snapshot and emits one finding across both voices.
    expect(brief.internal.map((f) => f.findingId)).toEqual(['listening:0-0', 'listening:1-0', 'tension:0']);
    const tension = brief.internal.find((f) => f.findingId === 'tension:0');
    expect(brief.internal[0].lens).toBe('listening');
    expect(tension?.lens).toBe('tension');

    // The Interpret lens read the Evidence findings and anchored its tension to the
    // units behind them — interpretive output is still evidence-anchored, across sources.
    expect(isEvidenceAnchored(tension!)).toBe(true);
    expect([...(tension?.evidenceLinks ?? [])].sort()).toEqual(['u1', 'u2']);
    expect(tension?.supportSet).toEqual({ sourceCount: 2, unitCount: 2 });

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

  it('produces no later-wave findings when the Evidence wave found nothing to build on', async () => {
    // No cleared units -> no Evidence findings -> the Interpret lens has no prior
    // findings to synthesize from, so the stage stays silent rather than straining.
    const repo = new InMemoryUnitRepository();
    await repo.saveUnit(scope, pendingUnit('u1', 'spk-a', 'a comment')); // left pending
    const gate = new DeidGate(new TrivialDeidDetector(), repo);

    const brief = await stagedPipeline(gate).synthesize(scope);
    expect(brief.internal).toHaveLength(0);
  });

  it('runs the two Interpret siblings (Tension + Objective) against the same snapshot — neither sees the other', async () => {
    const { gate } = await clearedScopeWithUnits();

    // Record the prior-finding ids each emit call was handed.
    const seenPriorIds: string[][] = [];
    const spy = new FakeLlmProvider((payload) => {
      if (payload.task !== 'disposition' && (payload.priorFindings?.length ?? 0) > 0) {
        seenPriorIds.push((payload.priorFindings ?? []).map((f) => f.findingId));
      }
      return defaultFakeResponse(payload);
    });

    // Culture Pattern is now the SOLE Aggregate lens; Tension and Objective are the Interpret
    // pair (frame-matchers). Wave order: Evidence -> Aggregate (Culture) -> Interpret (Tension,
    // Objective). So Culture sees only the Listening findings; the two Interpret siblings each see
    // the SAME snapshot (Listening + Culture) and NEITHER sees the other's output.
    const brief = await new LensPipeline(gate, spy, [
      new ListeningLens(),
      new CulturePatternLens(),
      new TensionLens(),
      new ObjectiveLens(),
    ]).synthesize(scope);

    expect(seenPriorIds).toEqual([
      ['listening:0-0', 'listening:1-0'], // Culture (Aggregate) — Evidence only
      ['listening:0-0', 'listening:1-0', 'culture:0'], // Tension (Interpret) — reads Aggregate, not its sibling
      ['listening:0-0', 'listening:1-0', 'culture:0'], // Objective (Interpret) — same snapshot, not its sibling
    ]);

    // Accumulated set in wave order; the two Interpret findings anchor to the Evidence units.
    expect(brief.internal.map((f) => f.findingId)).toEqual([
      'listening:0-0',
      'listening:1-0',
      'culture:0',
      'tension:0',
      'objective:0',
    ]);
    const tension = brief.internal.find((f) => f.findingId === 'tension:0');
    const objective = brief.internal.find((f) => f.findingId === 'objective:0');
    expect([...(tension?.evidenceLinks ?? [])].sort()).toEqual(['u1', 'u2']);
    expect([...(objective?.evidenceLinks ?? [])].sort()).toEqual(['u1', 'u2']);
  });

  it('funnels Evidence -> Meaning: Human Meaning reads the Listening findings, not the units', async () => {
    const { gate } = await clearedScopeWithUnits();

    // Record the prior-finding ids each emit call was handed.
    const seenPriorIds: string[][] = [];
    const spy = new FakeLlmProvider((payload) => {
      if (payload.task !== 'disposition') {
        seenPriorIds.push((payload.priorFindings ?? []).map((f) => f.findingId));
      }
      return defaultFakeResponse(payload);
    });

    const brief = await new LensPipeline(gate, spy, [
      new ListeningLens(),
      new HumanMeaningLens(),
    ]).synthesize(scope);

    // Both lenses are per-voice. Listening (Evidence) reads the units — its prior-findings
    // snapshot is empty on each of its two per-unit calls. Human Meaning (Meaning, one wave
    // later) fans out over the two Listening findings — each call reads exactly one, the
    // funnel: the interpretive lens works from the surfaced voices, not the raw units.
    expect(seenPriorIds).toEqual([[], [], ['listening:0-0'], ['listening:1-0']]);

    // Listening surfaced each voice (verbatim); Human Meaning interpreted each (noticing),
    // INHERITING the single unit behind the Listening finding it named — a meaning finding
    // structurally carries exactly one unit.
    expect(brief.internal.map((f) => f.findingId)).toEqual([
      'listening:0-0',
      'listening:1-0',
      'meaning:0-0',
      'meaning:1-0',
    ]);
    const listening = brief.internal.find((f) => f.findingId === 'listening:0-0');
    const meaning = brief.internal.find((f) => f.findingId === 'meaning:0-0');
    expect(listening?.verbatim).not.toBeNull(); // surfacing
    expect(listening?.noticing).toBeNull();
    expect(meaning?.verbatim).toBeNull(); // interpretive
    expect(meaning?.noticing).not.toBeNull();
    expect([...(listening?.evidenceLinks ?? [])]).toEqual(['u1']); // per-voice: one unit
    expect([...(meaning?.evidenceLinks ?? [])]).toEqual(['u1']); // inherited listening:0-0's single anchor
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

    expect(brief.internal.map((f) => f.findingId)).toEqual(['listening:0-0', 'listening:1-0', 'tension:0']);
    expect(brief.internal.every((f) => f.clearedToClientSafe === false)).toBe(true);
    expect(brief.clientSafe).toHaveLength(0);
  });

  it('Discernment runs after Evidence and Interpret and sees their findings', async () => {
    const { gate } = await clearedScopeWithUnits();
    // tension:0 exists only because the Interpret lens (Tension) ran before Guardrail; that
    // Discernment can promote it proves it audited the accumulated Interpret output.
    const brief = await fullPipeline(gate, promotingProvider(['tension:0'])).synthesize(scope);

    expect(brief.internal.map((f) => f.findingId)).toEqual(['listening:0-0', 'listening:1-0', 'tension:0']); // revised in place
    expect(brief.clientSafe.map((f) => f.findingId)).toEqual(['tension:0']);

    // client-safe ⊆ internal, end to end: every client-safe id is present internally.
    const internalIds = new Set(brief.internal.map((f) => f.findingId));
    expect(brief.clientSafe.every((f) => internalIds.has(f.findingId))).toBe(true);
  });

  it('keeps a promoted-but-sensitive finding out of the client-safe layer (backstop holds)', async () => {
    const { gate } = await clearedScopeWithUnits();
    // Promote BOTH, but flag listening:0-0 sensitive — it must not cross over.
    const provider = promotingProvider(['listening:0-0', 'tension:0'], ['listening:0-0']);
    const brief = await fullPipeline(gate, provider).synthesize(scope);

    const sensitive = brief.internal.find((f) => f.findingId === 'listening:0-0');
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

describe('lens pipeline — Interpret wave (Inclusity Objective)', () => {
  it('runs Objective in the Interpret wave (alongside Tension) before Guardrail, and Discernment audits it', async () => {
    const { gate } = await clearedScopeWithUnits();
    // Promote the Interpret finding — only possible if Objective ran (Interpret wave) and
    // Discernment then audited its output, with nothing extra wired for that.
    const provider = promotingProvider(['objective:0']);
    const brief = await new LensPipeline(gate, provider, [
      new ListeningLens(),
      new TensionLens(),
      new ObjectiveLens(),
      new DiscernmentLens(),
    ]).synthesize(scope);

    // Wave order in the accumulated set: Evidence (per-voice), then the Interpret pair
    // (Tension registered before Objective, so tension:0 then objective:0).
    expect(brief.internal.map((f) => f.findingId)).toEqual([
      'listening:0-0',
      'listening:1-0',
      'tension:0',
      'objective:0',
    ]);
    // The Interpret finding anchored back to the units behind the prior findings.
    const objective = brief.internal.find((f) => f.findingId === 'objective:0');
    expect([...(objective?.evidenceLinks ?? [])].sort()).toEqual(['u1', 'u2']);
    // Discernment promoted it — proof it saw and audited the Interpret-wave output.
    expect(brief.clientSafe.map((f) => f.findingId)).toEqual(['objective:0']);
  });
});

describe('lens pipeline — Openings wave (Action Opening held internal-only)', () => {
  it('holds Action Opening even when Discernment promotes everything it audits', async () => {
    const { gate } = await clearedScopeWithUnits();

    // A Discernment that promotes EVERY finding it audits. It audits the waves before the
    // Guardrail (here Evidence + Interpret — Tension, Objective); Openings runs after it, so
    // opening:0 is never in its view and can never be auto-promoted.
    const promoteAllAudited = new FakeLlmProvider((payload) => {
      if (payload.task === 'disposition') {
        return {
          verdicts: (payload.priorFindings ?? []).map((f) => ({
            findingId: f.findingId,
            promote: true,
          })),
        };
      }
      return defaultFakeResponse(payload);
    });

    const brief = await new LensPipeline(gate, promoteAllAudited, [
      new ListeningLens(),
      new TensionLens(),
      new ObjectiveLens(),
      new DiscernmentLens(),
      new OpeningLens(),
    ]).synthesize(scope);

    // Openings runs last — the Action Opening finding sits at the end of the set.
    expect(brief.internal.map((f) => f.findingId)).toEqual([
      'listening:0-0',
      'listening:1-0',
      'tension:0',
      'objective:0',
      'opening:0',
    ]);

    // Everything Discernment audited was promoted and reaches the client-safe layer...
    expect(brief.clientSafe.map((f) => f.findingId)).toEqual([
      'listening:0-0',
      'listening:1-0',
      'tension:0',
      'objective:0',
    ]);

    // ...but the Action Opening finding is HELD: Discernment ran before it and never
    // saw it, so nothing auto-promotes it (its promoter is human review, deferred).
    const opening = brief.internal.find((f) => f.findingId === 'opening:0');
    expect(opening?.clearedToClientSafe).toBe(false);
    expect(brief.clientSafe.map((f) => f.findingId)).not.toContain('opening:0');
  });
});
