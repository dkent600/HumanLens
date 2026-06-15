import type { FastifyInstance } from 'fastify';
import type { AwilixContainer } from 'awilix';
import type { AppContainer } from '../composition-root.js';

interface IntakeBody {
  content: string;
  language: string;
  sourceRef: string;
  position: number;
  speakerToken: string;
}

// Demonstrates the full path: the front door resolves the actor (preHandler),
// then calls into the engine. The engine — not this route — enforces
// authorization, so a deny surfaces here as a 403 carrying the reason.
export function registerIntakeRoutes(
  app: FastifyInstance,
  container: AwilixContainer<AppContainer>,
): void {
  app.post<{ Params: { engagementId: string }; Body: IntakeBody }>(
    '/engagements/:engagementId/units',
    {
      schema: {
        description: 'Contribute a de-identified unit of material to an engagement (Intake).',
        tags: ['intake'],
        params: {
          type: 'object',
          required: ['engagementId'],
          properties: { engagementId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['content', 'language', 'sourceRef', 'position', 'speakerToken'],
          properties: {
            content: { type: 'string' },
            language: { type: 'string' },
            sourceRef: { type: 'string' },
            position: { type: 'integer' },
            speakerToken: { type: 'string' },
          },
        },
        response: {
          201: { type: 'object', additionalProperties: true },
          403: {
            type: 'object',
            required: ['error', 'reason'],
            properties: {
              error: { type: 'string' },
              reason: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const result = await container.cradle.intakeService.contributeMaterial(
        request.actor,
        request.params.engagementId,
        request.body,
      );
      if (!result.ok) {
        return reply.code(403).send({ error: 'forbidden', reason: result.denied.reason });
      }
      return reply.code(201).send(result.unit);
    },
  );
}
