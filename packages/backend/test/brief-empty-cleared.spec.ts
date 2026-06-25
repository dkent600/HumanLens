import { describe, expect, it } from 'vitest';
import { buildContainer, ASSUMED_ACTOR } from '../src/composition-root.js';
import { buildServer } from '../src/server.js';
import type { Scope } from '../src/seams/repository.js';
import type { Unit } from '../src/domain/types.js';

// The boundary between two cases that look similar but must differ:
//   - NO material for an engagement            -> not-found (404)
//   - material EXISTS but nothing has cleared  -> ok, with an EMPTY client-safe layer (200)
// Today only the no-material 404 case has a test; the units-exist-none-cleared case was
// asserted only in a BriefService comment. A unit that has not cleared the de-id gate
// can never reach the lenses, so synthesis yields no findings — but the engagement is
// NOT not-found, because it holds material.

const ENGAGEMENT_ID = 'eng:pending-only';

function pendingUnit(unitId: string): Unit {
  return {
    unitId,
    engagementId: 'will-be-stamped',
    ingestedBy: 'will-be-stamped',
    ingestedAt: '2026-01-01T00:00:00.000Z',
    sourceRef: 'src',
    position: 0,
    language: 'en',
    content: 'a de-identified comment that has not yet cleared the gate',
    deidStatus: 'pending', // present, but never scanned/cleared
    speakerToken: 'spk-a',
  };
}

describe('BriefService — engagement with units but none cleared', () => {
  it('returns ok with an EMPTY client-safe layer (not not-found)', async () => {
    const container = buildContainer();
    const scope: Scope = { engagementId: ENGAGEMENT_ID, actor: ASSUMED_ACTOR };
    await container.cradle.unitRepository.saveUnit(scope, pendingUnit('u1'));
    await container.cradle.unitRepository.saveUnit(scope, pendingUnit('u2'));

    const result = await container.cradle.briefService.viewClientSafeBrief(
      ASSUMED_ACTOR,
      ENGAGEMENT_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.brief.engagementId).toBe(ENGAGEMENT_ID);
      expect(result.brief.findings).toHaveLength(0); // nothing cleared -> nothing synthesized
    }
  });
});

describe('GET /engagements/:engagementId/brief — units exist, none cleared', () => {
  it('200 with an empty findings array (distinct from the 404 no-material case)', async () => {
    const container = buildContainer();
    const scope: Scope = { engagementId: ENGAGEMENT_ID, actor: ASSUMED_ACTOR };
    await container.cradle.unitRepository.saveUnit(scope, pendingUnit('u1'));
    const app = await buildServer(container);

    const res = await app.inject({ method: 'GET', url: `/engagements/${ENGAGEMENT_ID}/brief` });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { engagementId: string; findings: unknown[] };
    expect(body.engagementId).toBe(ENGAGEMENT_ID);
    expect(body.findings).toEqual([]);
    await app.close();
  }, 30000);
});
