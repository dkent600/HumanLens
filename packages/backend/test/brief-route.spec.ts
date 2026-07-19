import { describe, expect, it } from 'vitest';
import { asValue } from 'awilix';
import { buildContainer } from '../src/composition-root.js';
import { buildServer } from '../src/server.js';
import { deny } from '../src/seams/authorization.js';
import {
  seedFixtureEngagement,
  fixtureLlmProvider,
  FIXTURE_ENGAGEMENT_ID,
} from '../src/fixture/dev-fixture.js';

// The route maps the engine's outcome to HTTP and never re-checks authz. These
// drive it through Fastify's `inject` (no network), proving the full front-door
// path: identity preHandler -> BriefService -> client-safe projection -> HTTP.

describe('GET /engagements/:engagementId/brief', () => {
  it('200 returns the client-safe brief (client-safe ⊊ internal)', async () => {
    const container = buildContainer({ llmProvider: fixtureLlmProvider() });
    await seedFixtureEngagement(container.cradle.unitRepository);
    const app = await buildServer(container);

    const res = await app.inject({ method: 'GET', url: `/engagements/${FIXTURE_ENGAGEMENT_ID}/brief` });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { engagementId: string; findings: { findingId: string }[] };
    expect(body.engagementId).toBe(FIXTURE_ENGAGEMENT_ID);
    expect(body.findings.map((f) => f.findingId)).toEqual(['listening:0-0', 'tension:0']);
    await app.close();
  }, 30000);

  it('404 for an engagement the system holds no material for', async () => {
    const container = buildContainer({ llmProvider: fixtureLlmProvider() });
    const app = await buildServer(container);

    const res = await app.inject({ method: 'GET', url: '/engagements/eng:unknown/brief' });

    expect(res.statusCode).toBe(404);
    expect((res.json() as { error: string }).error).toBe('not-found');
    await app.close();
  }, 30000);

  it('403 carrying the reason when authorization denies (deny is first-class; dormant in V1)', async () => {
    const container = buildContainer({ llmProvider: fixtureLlmProvider() });
    await seedFixtureEngagement(container.cradle.unitRepository);
    // Swap in a denying seam before the (singleton) BriefService is first resolved.
    container.register({
      authorization: asValue({ authorize: () => Promise.resolve(deny('actor not granted access to this engagement')) }),
    });
    const app = await buildServer(container);

    const res = await app.inject({ method: 'GET', url: `/engagements/${FIXTURE_ENGAGEMENT_ID}/brief` });

    expect(res.statusCode).toBe(403);
    const body = res.json() as { error: string; reason: string };
    expect(body.error).toBe('forbidden');
    expect(body.reason).toBe('actor not granted access to this engagement');
    await app.close();
  }, 30000);
});
