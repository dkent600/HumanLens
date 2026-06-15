import { describe, expect, it } from 'vitest';
import { AssumedIdentity } from '../src/seams/identity.js';
import type { Actor } from '../src/domain/types.js';

describe('identity seam (V1 assumed actor)', () => {
  it('resolves the assumed actor regardless of request context', async () => {
    const actor: Actor = { id: 'actor:assumed', displayName: 'Assumed' };
    const identity = new AssumedIdentity(actor);

    const resolved = await identity.resolveActor({ headers: {} });

    expect(resolved).toEqual(actor);
  });
});
