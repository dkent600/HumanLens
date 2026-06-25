import { describe, expect, it } from 'vitest';
import { asValue } from 'awilix';
import { buildContainer, ASSUMED_ACTOR } from '../src/composition-root.js';
import { buildServer } from '../src/server.js';
import { deny } from '../src/seams/authorization.js';
import type { Scope } from '../src/seams/repository.js';
import type { Unit } from '../src/domain/types.js';

// The write-path routes, mirroring the GET /brief route test: drive the handlers
// through Fastify's `inject` (no network), proving the full front-door path — identity
// preHandler -> engine -> HTTP status mapping + DI wiring. Only GET /brief had a
// route-level test before; the POST handlers were unexercised at the wire even though
// their services are tested directly.

const validBody = {
  content: 'a de-identified comment',
  language: 'en',
  sourceRef: 'survey-1',
  position: 0,
  speakerToken: 'spk-1',
};

describe('POST /engagements/:engagementId/units', () => {
  it('201 stores the unit as pending and echoes it back', async () => {
    const container = buildContainer();
    const app = await buildServer(container);

    const res = await app.inject({
      method: 'POST',
      url: '/engagements/eng:1/units',
      payload: validBody,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as { unitId: string; engagementId: string; deidStatus: string };
    expect(body.unitId).toBeTruthy();
    expect(body.engagementId).toBe('eng:1');
    expect(body.deidStatus).toBe('pending'); // a new unit cannot skip the gate
    await app.close();
  }, 30000);

  it('403 carrying the reason when authorization denies (deny is first-class; dormant in V1)', async () => {
    const container = buildContainer();
    // Swap in a denying seam before the (singleton) IntakeService is first resolved.
    container.register({
      authorization: asValue({
        authorize: () => Promise.resolve(deny('actor not granted access to this engagement')),
      }),
    });
    const app = await buildServer(container);

    const res = await app.inject({
      method: 'POST',
      url: '/engagements/eng:1/units',
      payload: validBody,
    });

    expect(res.statusCode).toBe(403);
    const body = res.json() as { error: string; reason: string };
    expect(body.error).toBe('forbidden');
    expect(body.reason).toBe('actor not granted access to this engagement');
    await app.close();
  }, 30000);

  it('400 when the body is missing a required field (Fastify schema validation)', async () => {
    const container = buildContainer();
    const app = await buildServer(container);

    const { speakerToken: _omitted, ...missingSpeakerToken } = validBody;
    const res = await app.inject({
      method: 'POST',
      url: '/engagements/eng:1/units',
      payload: missingSpeakerToken,
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  }, 30000);
});

describe('POST /engagements/:engagementId/deid/scan', () => {
  it('200 returns the aggregate {scanned, cleared, flagged} summary', async () => {
    const container = buildContainer();
    const scope: Scope = { engagementId: 'eng:scan', actor: ASSUMED_ACTOR };
    await container.cradle.unitRepository.saveUnit(scope, pendingUnit('u1', 'spk-a'));
    await container.cradle.unitRepository.saveUnit(scope, pendingUnit('u2', 'spk-b'));
    const app = await buildServer(container);

    const res = await app.inject({ method: 'POST', url: '/engagements/eng:scan/deid/scan' });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { scanned: number; cleared: number; flagged: number };
    // TrivialDeidDetector clears clean content by default.
    expect(body).toEqual({ scanned: 2, cleared: 2, flagged: 0 });
    await app.close();
  }, 30000);
});

function pendingUnit(unitId: string, speakerToken: string): Unit {
  return {
    unitId,
    engagementId: 'will-be-stamped',
    ingestedBy: 'will-be-stamped',
    ingestedAt: '2026-01-01T00:00:00.000Z',
    sourceRef: 'src',
    position: 0,
    language: 'en',
    content: 'a clean de-identified comment',
    deidStatus: 'pending',
    speakerToken,
  };
}
