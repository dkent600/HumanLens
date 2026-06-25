import { resolve } from 'aurelia';
import { IntakeStore } from '../stores/intake-store';

// The intake screen's view-model: a transient routed component owning UI behavior
// only. The in-progress compose fields below are ephemeral input scratch (cleared on
// Add, not durable); all durable state — the draft list, submission status, scan
// summary — lives in the IntakeStore singleton.
//
// This is a contribution surface for ALREADY-de-identified material, not a de-id
// tool. The actor de-identifies before entry; the gate is the backstop.
export class IntakePage {
  readonly store: IntakeStore = resolve(IntakeStore);

  // Ephemeral compose buffer (the unit currently being typed).
  content = '';
  speakerToken = '';
  sourceRef = '';
  language = 'en';

  get canAdd(): boolean {
    return (
      this.content.trim().length > 0 &&
      this.speakerToken.trim().length > 0 &&
      this.sourceRef.trim().length > 0
    );
  }

  add(): void {
    if (!this.canAdd) {
      return;
    }
    this.store.addDraft({
      content: this.content.trim(),
      speakerToken: this.speakerToken.trim(),
      sourceRef: this.sourceRef.trim(),
      language: this.language.trim() || 'en',
      position: this.store.drafts.length,
    });
    // Keep speakerToken / sourceRef so several comments from one source add quickly.
    this.content = '';
  }

  submit(): Promise<void> {
    return this.store.submitAll();
  }

  scan(): Promise<void> {
    return this.store.scan();
  }
}
