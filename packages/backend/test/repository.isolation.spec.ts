import { describe, expect, it } from 'vitest';
import { InMemoryUnitRepository } from '../src/seams/repository.js';
import type { Actor, Unit } from '../src/domain/types.js';

const actorA: Actor = { id: 'actor:a' };
const actorB: Actor = { id: 'actor:b' };

function makeUnit(unitId: string): Unit {
  return {
    unitId,
    engagementId: 'will-be-stamped',
    ingestedBy: 'will-be-stamped',
    ingestedAt: '2026-01-01T00:00:00.000Z',
    sourceRef: 'src',
    position: 0,
    language: 'en',
    content: 'content',
    deidStatus: 'pending',
    speakerToken: 'spk',
  };
}

describe('repository engagement isolation invariant', () => {
  it("never surfaces one engagement's units in another", async () => {
    const repo = new InMemoryUnitRepository();
    await repo.saveUnit({ engagementId: 'eng:A', actor: actorA }, makeUnit('u1'));
    await repo.saveUnit({ engagementId: 'eng:B', actor: actorB }, makeUnit('u2'));

    const aUnits = await repo.listUnits({ engagementId: 'eng:A', actor: actorA });
    const bUnits = await repo.listUnits({ engagementId: 'eng:B', actor: actorB });

    expect(aUnits.map((u) => u.unitId)).toEqual(['u1']);
    expect(bUnits.map((u) => u.unitId)).toEqual(['u2']);

    // A unit stored under engagement A is unreachable from a scope on engagement B.
    const leaked = await repo.getUnit({ engagementId: 'eng:B', actor: actorB }, 'u1');
    expect(leaked).toBeUndefined();
  });

  it('stamps the operating scope onto saved units', async () => {
    const repo = new InMemoryUnitRepository();
    const saved = await repo.saveUnit({ engagementId: 'eng:A', actor: actorA }, makeUnit('u1'));
    expect(saved.engagementId).toBe('eng:A');
    expect(saved.ingestedBy).toBe('actor:a');
  });
});
