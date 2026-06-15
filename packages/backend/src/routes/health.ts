import type { FastifyInstance } from 'fastify';

export function registerHealthRoute(app: FastifyInstance): void {
  app.get(
    '/health',
    {
      schema: {
        description: 'Liveness check.',
        tags: ['system'],
        response: {
          200: {
            type: 'object',
            required: ['status'],
            properties: { status: { type: 'string' } },
          },
        },
      },
    },
    () => ({ status: 'ok' }),
  );
}
