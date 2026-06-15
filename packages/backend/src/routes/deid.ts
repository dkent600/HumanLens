import type { FastifyInstance } from 'fastify';
import type { AwilixContainer } from 'awilix';
import type { AppContainer } from '../composition-root.js';

// Runs the de-identification gate over an engagement's pending units. A machine
// step within the (already-authorized) request — it does not re-check authz.
export function registerDeidRoutes(
  app: FastifyInstance,
  container: AwilixContainer<AppContainer>,
): void {
  app.post<{ Params: { engagementId: string } }>(
    '/engagements/:engagementId/deid/scan',
    {
      schema: {
        description: "Scan an engagement's pending units through the de-identification gate.",
        tags: ['deid'],
        params: {
          type: 'object',
          required: ['engagementId'],
          properties: { engagementId: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            required: ['scanned', 'cleared', 'flagged'],
            properties: {
              scanned: { type: 'integer' },
              cleared: { type: 'integer' },
              flagged: { type: 'integer' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const summary = await container.cradle.deidGate.scanPending({
        engagementId: request.params.engagementId,
        actor: request.actor,
      });
      return reply.code(200).send(summary);
    },
  );
}
