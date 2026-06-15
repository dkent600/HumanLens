import type { Actor, DeidStatus, EngagementId, Unit, UnitId } from '../domain/types.js';

// The repository seam. Its signatures are shaped as if a real store backed it:
// ASYNC, and carrying engagement + actor SCOPE on every operation — so a
// concrete store can drop in later without touching call sites.

export interface Scope {
  readonly engagementId: EngagementId;
  readonly actor: Actor;
}

export interface UnitRepository {
  saveUnit(scope: Scope, unit: Unit): Promise<Unit>;
  getUnit(scope: Scope, unitId: UnitId): Promise<Unit | undefined>;
  listUnits(scope: Scope): Promise<readonly Unit[]>;
  /** Update a unit's de-id status, scoped — returns undefined if no such unit in scope. */
  setDeidStatus(scope: Scope, unitId: UnitId, status: DeidStatus): Promise<Unit | undefined>;
}

/**
 * In-memory (Map-backed) implementation. Even as a mock it ENFORCES the
 * engagement isolation invariant: reads are keyed by the scope's engagement, so
 * a unit stored under engagement A is unreachable from a scope on engagement B.
 * Scoping is part of the trust story being demonstrated, not something the mock
 * waves away.
 */
export class InMemoryUnitRepository implements UnitRepository {
  private readonly byEngagement = new Map<EngagementId, Map<UnitId, Unit>>();

  saveUnit(scope: Scope, unit: Unit): Promise<Unit> {
    // Stamp the record with the operating scope so a caller cannot smuggle a
    // unit into a different engagement than the one it is operating in.
    const stamped: Unit = {
      ...unit,
      engagementId: scope.engagementId,
      ingestedBy: scope.actor.id,
    };
    const units = this.byEngagement.get(scope.engagementId) ?? new Map<UnitId, Unit>();
    units.set(stamped.unitId, stamped);
    this.byEngagement.set(scope.engagementId, units);
    return Promise.resolve(stamped);
  }

  getUnit(scope: Scope, unitId: UnitId): Promise<Unit | undefined> {
    return Promise.resolve(this.byEngagement.get(scope.engagementId)?.get(unitId));
  }

  listUnits(scope: Scope): Promise<readonly Unit[]> {
    return Promise.resolve([...(this.byEngagement.get(scope.engagementId)?.values() ?? [])]);
  }

  setDeidStatus(scope: Scope, unitId: UnitId, status: DeidStatus): Promise<Unit | undefined> {
    // Keyed by the scope's engagement, so a unit in another engagement is
    // unreachable here — the isolation invariant holds for updates too.
    const units = this.byEngagement.get(scope.engagementId);
    const existing = units?.get(unitId);
    if (!units || !existing) {
      return Promise.resolve(undefined);
    }
    const updated: Unit = { ...existing, deidStatus: status };
    units.set(unitId, updated);
    return Promise.resolve(updated);
  }
}
