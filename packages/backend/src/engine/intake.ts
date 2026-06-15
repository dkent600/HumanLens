import { randomUUID } from 'node:crypto';
import type { Actor, EngagementId, Unit, UnitDraft } from '../domain/types.js';
import type { AuthorizationSeam, Denial } from '../seams/authorization.js';
import type { UnitRepository } from '../seams/repository.js';

// Intake is an actor-initiated boundary, so the engine asks the authorization
// seam BEFORE doing anything — it is self-protecting whatever calls it, rather
// than trusting the web layer to have filtered first. A new unit enters with
// deid_status 'pending'; it cannot reach the lenses until the de-identification
// gate clears it (gate deferred).

export type IntakeResult =
  | { readonly ok: true; readonly unit: Unit }
  | { readonly ok: false; readonly denied: Denial };

export class IntakeService {
  constructor(
    private readonly authorization: AuthorizationSeam,
    private readonly units: UnitRepository,
  ) {}

  async contributeMaterial(
    actor: Actor,
    engagementId: EngagementId,
    draft: UnitDraft,
  ): Promise<IntakeResult> {
    const decision = await this.authorization.authorize({
      actor,
      engagementId,
      action: { type: 'intake.contribute' },
    });
    if (!decision.allowed) {
      // Deny path: refuse to proceed, preserve the reason. Nothing is written.
      return { ok: false, denied: decision };
    }

    const unit: Unit = {
      unitId: randomUUID(),
      engagementId,
      ingestedBy: actor.id,
      ingestedAt: new Date().toISOString(),
      sourceRef: draft.sourceRef,
      position: draft.position,
      language: draft.language,
      content: draft.content,
      deidStatus: 'pending',
      speakerToken: draft.speakerToken,
    };
    const saved = await this.units.saveUnit({ engagementId, actor }, unit);
    return { ok: true, unit: saved };
  }
}
