import { describe, expect, it } from 'vitest';
import { BriefService } from '../src/engine/brief-service.js';
import { LensPipeline } from '../src/engine/lens-pipeline.js';
import { AllowAllAuthorization, deny } from '../src/seams/authorization.js';
import { InMemoryUnitRepository } from '../src/seams/repository.js';
import { buildContainer, ASSUMED_ACTOR } from '../src/composition-root.js';
import {
  seedFixtureEngagement,
  fixtureLlmProvider,
  FIXTURE_ENGAGEMENT_ID,
} from '../src/fixture/dev-fixture.js';

// A pipeline stub that fails if synthesized — proves the deny and not-found paths
// short-circuit BEFORE any synthesis happens.
const neverPipeline = {
  synthesize: () => {
    throw new Error('pipeline must not run on the deny / not-found path');
  },
} as unknown as LensPipeline;

describe('BriefService — layer-view read (self-protecting)', () => {
  it('authorizes, synthesizes, and returns ONLY the promoted client-safe subset', async () => {
    // Full wiring with the fixture's promoting fake, exercising the real pipeline.
    const container = buildContainer({ llmProvider: fixtureLlmProvider() });
    await seedFixtureEngagement(container.cradle.unitRepository);

    const result = await container.cradle.briefService.viewClientSafeBrief(
      ASSUMED_ACTOR,
      FIXTURE_ENGAGEMENT_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.brief.engagementId).toBe(FIXTURE_ENGAGEMENT_ID);
      // The engine holds 6 findings internally; the client sees only the promoted,
      // non-sensitive subset — meaning:0 was promoted but flagged sensitive (held by
      // the backstop), culture/objective/opening were never promoted. client-safe ⊊ internal.
      expect(result.brief.findings.map((f) => f.findingId)).toEqual(['listening:0', 'tension:0']);

      // Support is derived and honest: listening:0 cites all 5 units across 4 sources.
      const listening = result.brief.findings.find((f) => f.findingId === 'listening:0');
      expect(listening?.support).toEqual({ sourceCount: 4, unitCount: 5 });

      // No internal-only gating field crosses the projection.
      expect(listening).not.toHaveProperty('clearedToClientSafe');
      expect(listening).not.toHaveProperty('sensitivity');
    }
  });

  it('refuses and preserves the reason when authorization denies — nothing synthesized', async () => {
    const denying = { authorize: () => Promise.resolve(deny('actor not granted access to this engagement')) };
    const repo = new InMemoryUnitRepository();
    const service = new BriefService(denying, repo, neverPipeline);

    const result = await service.viewClientSafeBrief(ASSUMED_ACTOR, 'eng:1');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('denied');
      if (result.reason === 'denied') {
        expect(result.denied.reason).toBe('actor not granted access to this engagement');
      }
    }
  });

  it('returns not-found for an engagement with no material — without synthesizing', async () => {
    const repo = new InMemoryUnitRepository(); // empty
    const service = new BriefService(new AllowAllAuthorization(), repo, neverPipeline);

    const result = await service.viewClientSafeBrief(ASSUMED_ACTOR, 'eng:unknown');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('not-found');
    }
  });
});
