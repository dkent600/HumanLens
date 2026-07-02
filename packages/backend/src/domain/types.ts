// Core domain shapes. "Shapes now, concrete types later" (build_approach.md):
// the fields and their meaning are fixed; richer modeling lands with the engine.

export type EngagementId = string;
export type ActorId = string;
export type UnitId = string;

/** The Inclusity staff member operating the tool. Known by design; in V1 assumed. */
export interface Actor {
  readonly id: ActorId;
  readonly displayName?: string;
}

/** The two output layers. The client-safe layer is a subset of the internal one. */
export type BriefType = 'internal' | 'client-safe';

/**
 * A structured action identifier — deliberately NOT a free string. The set is
 * left open, but it must be expressive enough to name layer-scoped reads (the
 * most consequential authorization), e.g. "view the internal vs client-safe layer".
 */
export interface Action {
  readonly type: string;
  /** Which brief layer this action concerns (the internal vs client-safe read distinction). */
  readonly briefType?: BriefType;
}

/** The de-identification gate's enforcement handle. A unit cannot reach the lenses unless `cleared`. */
export type DeidStatus = 'pending' | 'cleared' | 'flagged';

/**
 * The common interface every unit carries (one de-identified piece of qualitative
 * material). Type-specific extensions + capability-matching are deferred.
 */
export interface Unit {
  readonly unitId: UnitId;
  readonly engagementId: EngagementId;
  readonly ingestedBy: ActorId;
  readonly ingestedAt: string;
  readonly sourceRef: string;
  readonly position: number;
  readonly language: string;
  readonly content: string;
  readonly deidStatus: DeidStatus;
  /** Anonymized, stable-within-engagement identity for the source — keeps support counts honest. */
  readonly speakerToken: string;
}

/** What an actor submits at Intake; the engine mints the identity/scoping fields. */
export interface UnitDraft {
  readonly content: string;
  readonly language: string;
  readonly sourceRef: string;
  readonly position: number;
  readonly speakerToken: string;
}
