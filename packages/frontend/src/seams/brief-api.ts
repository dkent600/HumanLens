import { DI } from 'aurelia';
import axios, { type AxiosInstance } from 'axios';
import type { ClientSafeBrief } from '@humanlens/shared';

// The frontend's ONE interface-token seam (the analog of the engine's external
// boundaries). It is the only layer that touches HTTP; Stores depend on this
// abstraction, and tests inject a deterministic fake so Store -> view-model -> view
// run with no server. The Axios implementation lives behind it.
//
// Expected outcomes are RESULT VALUES, not exceptions — mirroring the engine's
// "deny is first-class" stance. The reason set is thin for the read path:
//   - 'not-found' : the engagement has no brief (HTTP 404).
//   - 'denied'    : the layer-view authorization seam refused (HTTP 403). The seam
//                   lands in this slice but resolves trivially in V1, so this is
//                   real-but-dormant — built and ready before any policy denies.
// 'not-ready' is RESERVED for when brief generation becomes async/stored and a brief
// can exist-but-not-yet-be-ready; the on-demand GET route never returns it today.
// A genuine transport failure is NOT an expected outcome and propagates as a throw.

export type BriefReason = 'not-found' | 'denied';

export type BriefResult =
  | { readonly ok: true; readonly brief: ClientSafeBrief }
  | { readonly ok: false; readonly reason: BriefReason };

export interface IBriefApi {
  getBrief(engagementId: string): Promise<BriefResult>;
}

export const IBriefApi = DI.createInterface<IBriefApi>('IBriefApi');

export class AxiosBriefApi implements IBriefApi {
  // Relative base URL: in dev a Vite proxy forwards `/engagements` to the Fastify
  // backend; in production one Fastify process serves both the UI and the API on the
  // same origin. Either way the same relative path works.
  private readonly http: AxiosInstance = axios.create();

  async getBrief(engagementId: string): Promise<BriefResult> {
    try {
      const res = await this.http.get<ClientSafeBrief>(
        `/engagements/${encodeURIComponent(engagementId)}/brief`,
      );
      return { ok: true, brief: res.data };
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        if (err.response.status === 404) return { ok: false, reason: 'not-found' };
        if (err.response.status === 403) return { ok: false, reason: 'denied' };
      }
      // Not an expected outcome — let transport failures surface.
      throw err;
    }
  }
}
