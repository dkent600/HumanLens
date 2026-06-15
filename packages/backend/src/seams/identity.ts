import type { Actor } from '../domain/types.js';

// The identity seam answers "who is acting?". It is resolved at the web layer
// once per request and threaded inward — the engine never parses sessions.

/** A framework-agnostic view of the request, so this seam never depends on Fastify. */
export interface IdentityContext {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
}

export interface IdentitySeam {
  resolveActor(context: IdentityContext): Promise<Actor>;
}

/** V1: a single assumed actor; no sign-in exists yet. */
export class AssumedIdentity implements IdentitySeam {
  constructor(private readonly actor: Actor) {}

  resolveActor(_context: IdentityContext): Promise<Actor> {
    return Promise.resolve(this.actor);
  }
}
