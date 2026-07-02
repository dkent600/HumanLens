import type { ClientSafeBrief } from '@humanlens/shared';
import type { Actor, EngagementId } from '../domain/types.js';
import type { AuthorizationSeam, Denial } from '../seams/authorization.js';
import type { UnitRepository } from '../seams/repository.js';
import type { LensPipeline } from './lens-pipeline.js';

// Reading a brief is an ACTOR-FACING operation — the output screen's choice of
// which layer to view — so it is an authorization call site, the one that carries
// authz's real future weight (Maria may see the client-safe layer; the facilitator
// and Mitchell the internal one). Per the architecture's "engine is self-protecting"
// rule, the check lives HERE, not in the route: BriefService asks the authorization
// seam at its own boundary so the decision holds whatever calls the engine.
//
// In V1 the seam always allows, but the deny branch is real, first-class, and tested
// (mock the seam to deny → this refuses to synthesize). `synthesize` / `assembleBrief`
// stay machine steps that do NOT re-check authz; this is the one boundary that does.
//
// It returns the CLIENT-SAFE layer only, as the shared `ClientSafeBrief` DTO — never
// the internal candid set. The internal layer needs its own contract and trust-zone
// decision and is deferred; it must not be reached through this method.

export type ViewBriefResult =
  | { readonly ok: true; readonly brief: ClientSafeBrief }
  | { readonly ok: false; readonly reason: 'denied'; readonly denied: Denial }
  | { readonly ok: false; readonly reason: 'not-found' };

export class BriefService {
  constructor(
    private readonly authorization: AuthorizationSeam,
    private readonly units: UnitRepository,
    private readonly pipeline: LensPipeline,
  ) {}

  /** Authorize, then synthesize and project to the client-safe layer for the given engagement. */
  async viewClientSafeBrief(actor: Actor, engagementId: EngagementId): Promise<ViewBriefResult> {
    const decision = await this.authorization.authorize({
      actor,
      engagementId,
      // Brief-layer-scoped read — expressive enough to name WHICH brief layer, the
      // distinction authorization carries its real weight on. V1 always allows.
      action: { type: 'brief.view', briefType: 'client-safe' },
    });
    if (!decision.allowed) {
      // Deny path: refuse to proceed; nothing is synthesized. The reason is preserved.
      return { ok: false, reason: 'denied', denied: decision };
    }

    const scope = { engagementId, actor };

    // Not-found: an engagement the system holds no material for. (A known engagement
    // with units but nothing cleared/promoted is a different, valid case — it returns
    // ok with an empty client-safe layer, not a 404.)
    const units = await this.units.listUnits(scope);
    if (units.length === 0) {
      return { ok: false, reason: 'not-found' };
    }

    const assembled = await this.pipeline.synthesize(scope);
    return {
      ok: true,
      brief: { engagementId, findings: assembled.clientSafe },
    };
  }
}
