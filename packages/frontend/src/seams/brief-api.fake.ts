import type { IBriefApi, BriefResult } from './brief-api';

// The deterministic fake behind the Service seam. Tests inject it so Store ->
// view-model -> view run with no server and no network. It simply replays a
// scripted BriefResult.
export class FakeBriefApi implements IBriefApi {
  constructor(private readonly result: BriefResult) {}

  getBrief(_engagementId: string): Promise<BriefResult> {
    return Promise.resolve(this.result);
  }
}
