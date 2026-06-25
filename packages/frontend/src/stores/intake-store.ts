import { resolve } from 'aurelia';
import { ILogger } from '@aurelia/kernel';
import type { UnitSubmission, DeidScanSummary } from '@humanlens/shared';
import { IIntakeApi, type SubmitReason } from '../seams/intake-api';

// IntakeStore — the compose/submit write-path state, between the view-model and the
// intake seam. A plain concrete DI singleton (mirrors BriefStore), tested for real
// over a fake seam. It deals in UNITS (the actor's de-identified input), never
// internal findings; per-unit de-id status never crosses, so this holds only the
// AGGREGATE scan summary.
//
// The form is NOT a de-id tool: the actor de-identifies before entry and the gate is
// the backstop. The flow is compose -> submit -> scan -> observe the aggregate
// outcome. `flagged > 0` is "held for review" — a normal gate verdict, store state,
// never an error.

export type IntakeStatus = 'idle' | 'submitting' | 'submitted' | 'scanning' | 'scanned' | 'error';

/** One composed, not-yet-submitted unit (client-side draft). */
export type DraftUnit = UnitSubmission;

export class IntakeStore {
  private readonly api: IIntakeApi = resolve(IIntakeApi);
  private readonly log = resolve(ILogger).scopeTo('IntakeStore');

  // A single working engagement for the session. No EngagementStore in V1 (identity
  // assumed, engagement effectively single); intake -> brief navigation is deferred.
  readonly engagementId: string = `eng:intake-${newId()}`;

  status: IntakeStatus = 'idle';
  reason: SubmitReason | null = null;
  message: string | null = null;
  drafts: DraftUnit[] = [];
  submittedCount = 0;
  summary: DeidScanSummary | null = null;

  /** True once a scan has reported one or more units held back for review. */
  get flaggedHeld(): boolean {
    return (this.summary?.flagged ?? 0) > 0;
  }

  /** Add a composed unit to the pending drafts. */
  addDraft(draft: DraftUnit): void {
    this.drafts = [...this.drafts, draft];
  }

  /** Remove a pending draft by index. */
  removeDraft(index: number): void {
    this.drafts = this.drafts.filter((_, i) => i !== index);
  }

  /**
   * Submit every pending draft to the engagement. Stops at the first expected
   * failure (validation / denied) and surfaces it; on success the drafts are now
   * stored (pending de-id) and the local list is cleared.
   */
  async submitAll(): Promise<void> {
    if (this.drafts.length === 0) {
      return;
    }
    this.status = 'submitting';
    this.reason = null;
    this.message = null;
    this.summary = null;

    let submitted = 0;
    for (const draft of this.drafts) {
      const result = await this.api.submitUnit(this.engagementId, draft);
      if (!result.ok) {
        this.status = 'error';
        this.reason = result.reason;
        this.message = result.message ?? null;
        this.submittedCount = submitted;
        this.log.warn('intake submit failed', `${result.reason}: ${result.message ?? ''}`);
        return;
      }
      submitted += 1;
    }

    this.submittedCount = submitted;
    this.drafts = [];
    this.status = 'submitted';
    this.log.debug('intake submitted', `${submitted} unit(s)`);
  }

  /**
   * Run the de-identification gate over the engagement's pending units. The summary
   * is aggregate only; `flaggedHeld` derives the "held for review" state. The scan is
   * a machine step with no deny path, so there is no expected failure here.
   */
  async scan(): Promise<void> {
    this.status = 'scanning';
    this.summary = await this.api.runDeidScan(this.engagementId);
    this.status = 'scanned';
    this.log.debug('deid scan', `cleared ${this.summary.cleared}, flagged ${this.summary.flagged}`);
  }
}

// Stable-enough session id for the working engagement. Uses crypto.randomUUID when
// available, else a timestamp fallback — only needs to be unique per session.
function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID() : `${Date.now()}`;
}
