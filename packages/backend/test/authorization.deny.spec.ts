import { describe, expect, it } from 'vitest';
import { IntakeService } from '../src/engine/intake.js';
import { deny, type AuthorizationSeam } from '../src/seams/authorization.js';
import { InMemoryUnitRepository } from '../src/seams/repository.js';
import type { Actor, UnitDraft } from '../src/domain/types.js';

const actor: Actor = { id: 'actor:test' };
const draft: UnitDraft = {
  content: 'a de-identified comment',
  language: 'en',
  sourceRef: 'survey-1',
  position: 0,
  speakerToken: 'spk-1',
};

describe('authorization deny path', () => {
  it('refuses to proceed and preserves the reason when the seam denies', async () => {
    const denying: AuthorizationSeam = {
      authorize: () => Promise.resolve(deny('actor not granted access to this engagement')),
    };
    const repo = new InMemoryUnitRepository();
    const intake = new IntakeService(denying, repo);

    const result = await intake.contributeMaterial(actor, 'eng:1', draft);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.denied.reason).toBe('actor not granted access to this engagement');
    }
    // The deny path must not write anything.
    const stored = await repo.listUnits({ engagementId: 'eng:1', actor });
    expect(stored).toHaveLength(0);
  });

  it('proceeds and persists the unit when the seam allows', async () => {
    const allowing: AuthorizationSeam = {
      authorize: () => Promise.resolve({ allowed: true }),
    };
    const repo = new InMemoryUnitRepository();
    const intake = new IntakeService(allowing, repo);

    const result = await intake.contributeMaterial(actor, 'eng:1', draft);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.unit.deidStatus).toBe('pending');
      expect(result.unit.engagementId).toBe('eng:1');
    }
    const stored = await repo.listUnits({ engagementId: 'eng:1', actor });
    expect(stored).toHaveLength(1);
  });
});
