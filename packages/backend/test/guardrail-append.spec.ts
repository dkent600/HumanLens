import { describe, expect, it } from 'vitest';
import { DeidGate } from '../src/engine/deid-gate.js';
import { LensPipeline } from '../src/engine/lens-pipeline.js';
import { ListeningLens } from '../src/engine/lenses/listening-lens.js';
import { InMemoryUnitRepository, type Scope } from '../src/seams/repository.js';
import { TrivialDeidDetector } from '../src/seams/deid-detector.js';
import { FakeLlmProvider, type LlmProvider } from '../src/seams/llm-provider.js';
import { makeOrdinaryFinding, type Finding } from '../src/domain/finding.js';
import type { Layer, Lens } from '../src/engine/lenses/lens.js';
import type { Actor, Unit } from '../src/domain/types.js';

// The orchestrator folds the Guardrail stage by supersede-on-finding_id: a produced
// finding whose id MATCHES an accumulated one revises it in place (the Discernment
// audit's privilege — tested elsewhere), but a produced finding with a FRESH id
// APPENDS. That append branch (lens-pipeline.ts `supersedeByFindingId`) is the property
// that justified the supersede-by-id design (B2 in build_approach.md): a stray id
// collision on the client-gating path stays a VISIBLE append, never a silent drop.
//
// The real DiscernmentLens only ever emits revisions of prior finding ids, so a
// fresh-id Guardrail finding cannot come from it — it is driven here by a minimal
// Guardrail-layer lens that emits a brand-new finding.

const actor: Actor = { id: 'actor:test' };
const scope: Scope = { engagementId: 'eng:1', actor };

function pendingUnit(unitId: string, speakerToken: string): Unit {
  return {
    unitId,
    engagementId: 'will-be-stamped',
    ingestedBy: 'will-be-stamped',
    ingestedAt: '2026-01-01T00:00:00.000Z',
    sourceRef: 'src',
    position: 0,
    language: 'en',
    content: `content for ${unitId}`,
    deidStatus: 'pending',
    speakerToken,
  };
}

/** A Guardrail-layer lens that emits a brand-new finding under a fresh id (never a prior id). */
class FreshIdGuardrailLens implements Lens {
  readonly id = 'extra-guardrail';
  readonly layer: Layer = 'guardrail';

  run(units: readonly Unit[], _priorFindings: readonly Finding[], _provider: LlmProvider): Promise<readonly Finding[]> {
    return Promise.resolve([
      makeOrdinaryFinding({
        findingId: 'guardrail-extra:0',
        lens: 'discernment',
        verbatim: 'a fresh guardrail finding under a new id',
        evidenceLinks: ['u1'],
        units,
      }),
    ]);
  }
}

async function clearedGate(): Promise<DeidGate> {
  const repo = new InMemoryUnitRepository();
  await repo.saveUnit(scope, pendingUnit('u1', 'spk-a'));
  await repo.saveUnit(scope, pendingUnit('u2', 'spk-b'));
  const gate = new DeidGate(new TrivialDeidDetector(), repo);
  await gate.scanPending(scope);
  return gate;
}

describe('lens pipeline — Guardrail stage emitting a fresh finding id', () => {
  it('appends the fresh-id Guardrail finding rather than dropping it or superseding another', async () => {
    const gate = await clearedGate();
    const brief = await new LensPipeline(gate, new FakeLlmProvider(), [
      new ListeningLens(),
      new FreshIdGuardrailLens(),
    ]).synthesize(scope);

    // The Evidence finding is untouched, and the fresh-id Guardrail finding is appended
    // AFTER it (a visible append on the client-gating path, not a silent drop).
    expect(brief.internal.map((f) => f.findingId)).toEqual(['listening:0', 'guardrail-extra:0']);

    const evidence = brief.internal.find((f) => f.findingId === 'listening:0');
    expect([...(evidence?.evidenceLinks ?? [])].sort()).toEqual(['u1', 'u2']); // unchanged

    const fresh = brief.internal.find((f) => f.findingId === 'guardrail-extra:0');
    expect(fresh?.evidenceLinks).toEqual(['u1']);
    expect(fresh?.clearedToClientSafe).toBe(false); // the lens did not promote it -> held
    expect(brief.clientSafe).toHaveLength(0);
  });
});
