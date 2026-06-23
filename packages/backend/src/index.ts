import { buildContainer } from './composition-root.js';
import { buildServer } from './server.js';
import { FIXTURE_ENGAGEMENT_ID, fixtureLlmProvider, seedFixtureEngagement } from './fixture/dev-fixture.js';

// Entry point: wire the container, seed the demo fixture, build the server, listen.
//
// The dev bootstrap is the ONLY place the promoting fake and the fixture seed are
// wired in. `buildContainer` itself stays the silent default; here we override the
// LLM provider with the fixture's promoting fake and seed the demo engagement so the
// read slice has a non-empty client-safe brief to render.
const container = buildContainer({ llmProvider: fixtureLlmProvider() });
await seedFixtureEngagement(container.cradle.unitRepository);

const app = await buildServer(container);

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: '0.0.0.0' });
console.log(`Human Lens backend listening on http://localhost:${port} (docs at /docs)`);
console.log(`Demo fixture seeded: GET /engagements/${FIXTURE_ENGAGEMENT_ID}/brief`);
