import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { AwilixContainer } from 'awilix';
import type { Actor } from './domain/types.js';
import type { AppContainer } from './composition-root.js';
import { registerHealthRoute } from './routes/health.js';
import { registerIntakeRoutes } from './routes/intake.js';

// The thin front door. It serves the API, generates OpenAPI docs from the route
// schemas, and resolves the actor once per request — then calls into the engine.
// No lens/orchestration logic lives here.
export async function buildServer(container: AwilixContainer<AppContainer>): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(swagger, {
    openapi: {
      info: { title: 'Human Lens — Module 1 API', version: '0.0.0' },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  // Identity resolves once per request at the web layer, then is threaded inward.
  // Decorate with a null sentinel (Fastify v5 forbids reference-type defaults);
  // the preHandler below sets the real actor before any handler runs.
  app.decorateRequest('actor', null as unknown as Actor);
  app.addHook('preHandler', async (request: FastifyRequest) => {
    request.actor = await container.cradle.identity.resolveActor({ headers: request.headers });
  });

  registerHealthRoute(app);
  registerIntakeRoutes(app, container);

  return app;
}
