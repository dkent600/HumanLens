import type { DeidStatus, Unit, UnitId } from '../domain/types.js';
import type { DeidDetector } from '../seams/deid-detector.js';
import type { Scope, UnitRepository } from '../seams/repository.js';

// The de-identification gate — a HARD gate on the pipeline, not a feature added
// later. It is a machine step (it runs inside an already-authorized request and
// does not call the auth seams). Two responsibilities:
//   1. scan pending units via the (parked) detector and record cleared/flagged;
//   2. be the ONLY sanctioned source of units for lens processing — so the
//      lenses can never see material that went around the gate.

export interface DeidGateSummary {
  readonly scanned: number;
  readonly cleared: number;
  readonly flagged: number;
}

export class DeidGate {
  constructor(
    private readonly detector: DeidDetector,
    private readonly units: UnitRepository,
  ) {}

  /** Machine step: scan every pending unit in scope and record the verdict. */
  async scanPending(scope: Scope): Promise<DeidGateSummary> {
    const all = await this.units.listUnits(scope);
    let scanned = 0;
    let cleared = 0;
    let flagged = 0;
    for (const unit of all) {
      if (unit.deidStatus !== 'pending') {
        continue;
      }
      scanned += 1;
      const result = await this.detector.scan(unit.content, unit.language);
      const status: DeidStatus = result.cleared ? 'cleared' : 'flagged';
      await this.units.setDeidStatus(scope, unit.unitId, status);
      if (result.cleared) {
        cleared += 1;
      } else {
        flagged += 1;
      }
    }
    return { scanned, cleared, flagged };
  }

  /**
   * The hard gate. The ONLY way to obtain units for lens processing: a unit
   * that is not `cleared` can never be returned here. Lens orchestration takes
   * its input exclusively from this method.
   */
  async clearedUnitsForLenses(scope: Scope): Promise<readonly Unit[]> {
    const all = await this.units.listUnits(scope);
    return all.filter((unit) => unit.deidStatus === 'cleared');
  }

  /**
   * The human-confirmed checkpoint: a reviewer clears a flagged unit (or
   * confirms a flag). Wiring this to the authorization seam at the human-review
   * boundary is deferred with the rest of human review/capture.
   */
  recordHumanDecision(
    scope: Scope,
    unitId: UnitId,
    decision: Extract<DeidStatus, 'cleared' | 'flagged'>,
  ): Promise<Unit | undefined> {
    return this.units.setDeidStatus(scope, unitId, decision);
  }
}
