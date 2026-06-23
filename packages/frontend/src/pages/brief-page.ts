import { resolve } from 'aurelia';
import { BriefStore } from '../stores/brief-store';

// The review screen's view-model: a transient routed component that owns UI behavior
// only. It injects the BriefStore (singleton) and triggers the load; the Store owns
// the state and the structural transforms, the view binds to them. No durable state
// lives here.
//
// The engagement is hardcoded to the demo fixture for V1 — there is no engagement
// selection UI yet (that arrives with the intake slice). Kept in sync with the
// backend's FIXTURE_ENGAGEMENT_ID; temporary fixture coupling, removed when intake lands.
const DEMO_ENGAGEMENT_ID = 'eng:fixture-listening-brief';

export class BriefPage {
  readonly store: BriefStore = resolve(BriefStore);

  binding(): void {
    // Fire-and-forget: the Store tracks status, so the view can show loading -> loaded
    // without blocking render. `void` marks the floating promise as intentional.
    void this.store.load(DEMO_ENGAGEMENT_ID);
  }
}
