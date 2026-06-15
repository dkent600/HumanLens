import type { Actor } from './domain/types.js';

// The actor is resolved once per request by the identity seam (a preHandler
// hook) and threaded inward. Augment FastifyRequest so route handlers see it.
declare module 'fastify' {
  interface FastifyRequest {
    actor: Actor;
  }
}

export {};
