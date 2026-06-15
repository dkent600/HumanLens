import type { Action, Actor, EngagementId } from '../domain/types.js';

// The authorization seam answers "is this actor allowed to take this action in
// this engagement?". A deny is a FIRST-CLASS return value — a small decision
// object with a slot for the reason — never a bare boolean (which discards the
// "why") nor an exception (a deny is a normal, expected outcome, not a breakage).

export type AuthorizationDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string };

export type Denial = Extract<AuthorizationDecision, { allowed: false }>;

export const allow = (): AuthorizationDecision => ({ allowed: true });
export const deny = (reason: string): AuthorizationDecision => ({ allowed: false, reason });

export interface AuthorizationRequest {
  readonly actor: Actor;
  readonly engagementId: EngagementId;
  readonly action: Action;
}

export interface AuthorizationSeam {
  authorize(request: AuthorizationRequest): Promise<AuthorizationDecision>;
}

/**
 * V1: always allows. The deny branch is real and tested (mock this seam to
 * return a deny and assert the call site refuses), but no policy denies yet.
 * The platform layer swaps real policy in here without changing any call site.
 */
export class AllowAllAuthorization implements AuthorizationSeam {
  authorize(_request: AuthorizationRequest): Promise<AuthorizationDecision> {
    return Promise.resolve(allow());
  }
}
