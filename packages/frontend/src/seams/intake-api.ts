import { DI } from 'aurelia';
import axios, { type AxiosInstance } from 'axios';
import type { UnitSubmission, IntakeAck, DeidScanSummary } from '@humanlens/shared';

// The intake (write-path) seam — sibling of brief-api. The one outward boundary to
// the Fastify front door for intake; Stores depend on this abstraction, and tests
// inject the fake beside it. Expected outcomes are RESULT VALUES, not exceptions.
//
// The reason set maps onto the engine's real semantics:
//   - submitUnit: 'validation' (Fastify schema 400) | 'denied' (authz 403, dormant
//     in V1). Success returns the ack. A transport failure is NOT expected → throws.
//   - runDeidScan: a machine step with NO auth check and no expected failure, so it
//     returns the summary directly (transport failure throws). gate-flagged is NOT a
//     reason here — it is `summary.flagged`, a normal verdict the Store reads as state.

export type SubmitReason = 'validation' | 'denied';

export type SubmitResult =
  | { readonly ok: true; readonly ack: IntakeAck }
  | { readonly ok: false; readonly reason: SubmitReason; readonly message?: string };

export interface IIntakeApi {
  submitUnit(engagementId: string, submission: UnitSubmission): Promise<SubmitResult>;
  runDeidScan(engagementId: string): Promise<DeidScanSummary>;
}

export const IIntakeApi = DI.createInterface<IIntakeApi>('IIntakeApi');

export class AxiosIntakeApi implements IIntakeApi {
  // Relative base: the Vite dev proxy forwards `/engagements` to the backend; same
  // origin in production. (Shared with the brief seam's convention.)
  private readonly http: AxiosInstance = axios.create();

  async submitUnit(engagementId: string, submission: UnitSubmission): Promise<SubmitResult> {
    try {
      const res = await this.http.post<IntakeAck>(
        `/engagements/${encodeURIComponent(engagementId)}/units`,
        submission,
      );
      // The route returns the stored unit; the contract only consumes its id.
      return { ok: true, ack: { unitId: res.data.unitId } };
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        if (err.response.status === 400) {
          const message = (err.response.data as { message?: string } | undefined)?.message;
          return { ok: false, reason: 'validation', message };
        }
        if (err.response.status === 403) {
          const reason = (err.response.data as { reason?: string } | undefined)?.reason;
          return { ok: false, reason: 'denied', message: reason };
        }
      }
      // Not an expected outcome — let transport failures surface.
      throw err;
    }
  }

  async runDeidScan(engagementId: string): Promise<DeidScanSummary> {
    const res = await this.http.post<DeidScanSummary>(
      `/engagements/${encodeURIComponent(engagementId)}/deid/scan`,
    );
    return res.data;
  }
}
