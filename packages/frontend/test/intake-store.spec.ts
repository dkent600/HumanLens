import { describe, it, expect } from 'vitest';
import { DI, Registration } from 'aurelia';
import { LoggerConfiguration, LogLevel } from '@aurelia/kernel';
import type { UnitSubmission } from '@humanlens/shared';
import { IntakeStore } from '../src/stores/intake-store';
import { IIntakeApi, type SubmitResult } from '../src/seams/intake-api';
import { FakeIntakeApi } from '../src/seams/intake-api.fake';

function storeWith(api: IIntakeApi): IntakeStore {
  const container = DI.createContainer();
  container.register(
    LoggerConfiguration.create({ level: LogLevel.warn }),
    Registration.instance(IIntakeApi, api),
    Registration.singleton(IntakeStore, IntakeStore),
  );
  return container.get(IntakeStore);
}

function draft(content: string): UnitSubmission {
  return { content, language: 'en', sourceRef: 'survey-1', position: 0, speakerToken: 'spk-a' };
}

describe('IntakeStore — compose', () => {
  it('adds and removes drafts', () => {
    const store = storeWith(new FakeIntakeApi());
    store.addDraft(draft('a'));
    store.addDraft(draft('b'));
    expect(store.drafts.map((d) => d.content)).toEqual(['a', 'b']);
    store.removeDraft(0);
    expect(store.drafts.map((d) => d.content)).toEqual(['b']);
  });
});

describe('IntakeStore — submit', () => {
  it('submits all drafts, clears them, and lands in submitted', async () => {
    const fake = new FakeIntakeApi();
    const store = storeWith(fake);
    store.addDraft(draft('a'));
    store.addDraft(draft('b'));

    await store.submitAll();

    expect(store.status).toBe('submitted');
    expect(store.submittedCount).toBe(2);
    expect(store.drafts).toHaveLength(0);
    expect(fake.submitted).toHaveLength(2);
    // All submitted under the store's single working engagement.
    expect(fake.submitted.every((s) => s.engagementId === store.engagementId)).toBe(true);
  });

  it('surfaces a validation reason and stops at the first failure', async () => {
    const validation: SubmitResult = { ok: false, reason: 'validation', message: 'content required' };
    const store = storeWith(new FakeIntakeApi(validation));
    store.addDraft(draft('a'));

    await store.submitAll();

    expect(store.status).toBe('error');
    expect(store.reason).toBe('validation');
    expect(store.message).toBe('content required');
  });

  it('surfaces a denied reason (dormant in V1, but wired)', async () => {
    const denied: SubmitResult = { ok: false, reason: 'denied', message: 'not granted' };
    const store = storeWith(new FakeIntakeApi(denied));
    store.addDraft(draft('a'));

    await store.submitAll();

    expect(store.status).toBe('error');
    expect(store.reason).toBe('denied');
  });
});

describe('IntakeStore — scan', () => {
  it('records the aggregate summary; flagged > 0 derives held-for-review', async () => {
    const store = storeWith(new FakeIntakeApi(undefined, { scanned: 3, cleared: 2, flagged: 1 }));

    await store.scan();

    expect(store.status).toBe('scanned');
    expect(store.summary).toEqual({ scanned: 3, cleared: 2, flagged: 1 });
    expect(store.flaggedHeld).toBe(true);
  });

  it('flaggedHeld is false when nothing is flagged', async () => {
    const store = storeWith(new FakeIntakeApi(undefined, { scanned: 2, cleared: 2, flagged: 0 }));
    await store.scan();
    expect(store.flaggedHeld).toBe(false);
  });
});
