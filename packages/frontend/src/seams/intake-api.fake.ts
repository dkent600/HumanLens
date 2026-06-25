import type { UnitSubmission, DeidScanSummary } from '@humanlens/shared';
import type { IIntakeApi, SubmitResult } from './intake-api';

// The deterministic fake behind the intake seam. Tests inject it so Store ->
// view-model -> view run with no server. It records what it was asked to submit and
// replays scripted outcomes; `submitUnit` can be a fixed result or a per-call
// function (to script a validation/denied outcome for a specific unit).
export class FakeIntakeApi implements IIntakeApi {
  readonly submitted: { engagementId: string; submission: UnitSubmission }[] = [];
  scanCalls = 0;

  constructor(
    private readonly submitOutcome:
      | SubmitResult
      | ((submission: UnitSubmission, index: number) => SubmitResult) = defaultAck,
    private readonly scanSummary: DeidScanSummary = { scanned: 0, cleared: 0, flagged: 0 },
  ) {}

  // (id derives from call index — deterministic, no shared mutable counter)

  submitUnit(engagementId: string, submission: UnitSubmission): Promise<SubmitResult> {
    const index = this.submitted.length;
    this.submitted.push({ engagementId, submission });
    const result =
      typeof this.submitOutcome === 'function'
        ? this.submitOutcome(submission, index)
        : this.submitOutcome;
    return Promise.resolve(result);
  }

  runDeidScan(_engagementId: string): Promise<DeidScanSummary> {
    this.scanCalls += 1;
    return Promise.resolve(this.scanSummary);
  }
}

function defaultAck(_submission: UnitSubmission, index: number): SubmitResult {
  return { ok: true, ack: { unitId: `fake-unit-${index}` } };
}
