import { describe, expect, it } from 'vitest';
import { DeidGate } from '../src/engine/deid-gate.js';
import { InMemoryUnitRepository } from '../src/seams/repository.js';
import { TrivialDeidDetector } from '../src/seams/deid-detector.js';
import type { Actor, Unit } from '../src/domain/types.js';
import type { Scope } from '../src/seams/repository.js';

const actor: Actor = { id: 'actor:test' };
const scope: Scope = { engagementId: 'eng:1', actor };

function pendingUnit(unitId: string, content = 'a comment'): Unit {
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
    speakerToken: 'spk',
  };
}

describe('de-identification gate', () => {
  it('never admits a non-cleared unit to the lenses (hard gate)', async () => {
    const repo = new InMemoryUnitRepository();
    await repo.saveUnit(scope, pendingUnit('u1')); // stored as 'pending', never scanned
    const gate = new DeidGate(new TrivialDeidDetector(), repo);

    // Before clearing, the lenses can see nothing.
    expect(await gate.clearedUnitsForLenses(scope)).toHaveLength(0);
  });

  it('clears pending units via the detector, then admits them', async () => {
    const repo = new InMemoryUnitRepository();
    await repo.saveUnit(scope, pendingUnit('u1'));
    const gate = new DeidGate(new TrivialDeidDetector(), repo);

    const summary = await gate.scanPending(scope);

    expect(summary).toEqual({ scanned: 1, cleared: 1, flagged: 0 });
    const admitted = await gate.clearedUnitsForLenses(scope);
    expect(admitted.map((u) => u.unitId)).toEqual(['u1']);
  });

  it('flags units the detector is unhappy with and keeps them out of the lenses', async () => {
    const repo = new InMemoryUnitRepository();
    await repo.saveUnit(scope, pendingUnit('u1', 'mentions Acme Corp'));
    await repo.saveUnit(scope, pendingUnit('u2', 'a clean comment'));
    const gate = new DeidGate(new TrivialDeidDetector({ flagPatterns: [/Acme Corp/] }), repo);

    const summary = await gate.scanPending(scope);

    expect(summary).toEqual({ scanned: 2, cleared: 1, flagged: 1 });
    const admitted = await gate.clearedUnitsForLenses(scope);
    expect(admitted.map((u) => u.unitId)).toEqual(['u2']); // flagged u1 is excluded
  });

  it('lets a human clear a flagged unit (the human-confirmed checkpoint)', async () => {
    const repo = new InMemoryUnitRepository();
    await repo.saveUnit(scope, pendingUnit('u1', 'mentions Acme Corp'));
    const gate = new DeidGate(new TrivialDeidDetector({ flagPatterns: [/Acme Corp/] }), repo);
    await gate.scanPending(scope);
    expect(await gate.clearedUnitsForLenses(scope)).toHaveLength(0); // flagged

    await gate.recordHumanDecision(scope, 'u1', 'cleared');

    const admitted = await gate.clearedUnitsForLenses(scope);
    expect(admitted.map((u) => u.unitId)).toEqual(['u1']);
  });
});
