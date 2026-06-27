import type { FastifyInstance } from 'fastify';
import type { AwilixContainer } from 'awilix';
import type { AppContainer } from '../composition-root.js';

// GET an engagement's CLIENT-SAFE brief. The front door resolves the actor
// (preHandler), then calls into the engine's self-protecting BriefService, which
// runs the layer-view authorization check, synthesizes, and projects to the
// client-safe layer. This route NEVER re-checks authz and NEVER touches the
// internal layer — it only maps the engine's outcome to HTTP:
//   ok        -> 200 { engagementId, findings }
//   denied    -> 403 { error, reason }   (deny is first-class; dormant in V1)
//   not-found -> 404 { error }
export function registerBriefRoutes(
  app: FastifyInstance,
  container: AwilixContainer<AppContainer>,
): void {
  app.get<{ Params: { engagementId: string } }>(
    '/engagements/:engagementId/brief',
    {
      schema: {
        description: "Read an engagement's client-safe brief (the promoted, projected layer).",
        tags: ['brief'],
        params: {
          type: 'object',
          required: ['engagementId'],
          properties: { engagementId: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            required: ['engagementId', 'findings'],
            properties: {
              engagementId: { type: 'string' },
              findings: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['findingId', 'lens', 'verbatim', 'evidenceLinks', 'support', 'findingKind'],
                  properties: {
                    findingId: { type: 'string' },
                    lens: { type: 'string' },
                    // The speaker's words; null for an absence finding (no source to quote).
                    verbatim: { type: 'string', nullable: true },
                    // Literal English translation + source language — present only for a non-English finding.
                    translation: { type: 'string' },
                    sourceLanguage: { type: 'string' },
                    evidenceLinks: { type: 'array', items: { type: 'string' } },
                    support: {
                      type: 'object',
                      required: ['sourceCount', 'unitCount'],
                      properties: {
                        sourceCount: { type: 'integer' },
                        unitCount: { type: 'integer' },
                      },
                    },
                    findingKind: { type: 'string', enum: ['ordinary', 'absence'] },
                    parent: { type: 'string' },
                  },
                },
              },
            },
          },
          403: {
            type: 'object',
            required: ['error', 'reason'],
            properties: { error: { type: 'string' }, reason: { type: 'string' } },
          },
          404: {
            type: 'object',
            required: ['error'],
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const result = await container.cradle.briefService.viewClientSafeBrief(
        request.actor,
        request.params.engagementId,
      );
      if (result.ok) {
        return reply.code(200).send(result.brief);
      }
      if (result.reason === 'denied') {
        return reply.code(403).send({ error: 'forbidden', reason: result.denied.reason });
      }
      return reply.code(404).send({ error: 'not-found' });
    },
  );
}
