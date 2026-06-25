import { describe, it, expect } from 'vitest';
import { createFixture } from '@aurelia/testing';
import { Registration } from 'aurelia';
import { LoggerConfiguration, LogLevel } from '@aurelia/kernel';
import { IntakePage } from '../src/pages/intake-page';
import { IntakeStore } from '../src/stores/intake-store';
import { IIntakeApi } from '../src/seams/intake-api';
import { FakeIntakeApi } from '../src/seams/intake-api.fake';

const setup = (fake: FakeIntakeApi) =>
  createFixture(
    '<intake-page></intake-page>',
    {},
    [
      IntakePage,
      Registration.instance(IIntakeApi, fake),
      Registration.singleton(IntakeStore, IntakeStore),
      LoggerConfiguration.create({ level: LogLevel.warn }),
    ],
  ).started;

describe('intake-page', () => {
  it('renders the compose form', async () => {
    const { appHost } = await setup(new FakeIntakeApi());
    expect(appHost.textContent).toContain('Intake');
    expect(appHost.querySelector('textarea')).not.toBeNull();
  });

  it('shows the aggregate scan outcome, with held-for-review when flagged', async () => {
    const fake = new FakeIntakeApi(undefined, { scanned: 3, cleared: 2, flagged: 1 });
    const { appHost, container } = await setup(fake);

    const store = container.get(IntakeStore);
    store.addDraft({ content: 'a', language: 'en', sourceRef: 's', position: 0, speakerToken: 'spk-a' });
    await store.submitAll();
    await store.scan();
    await Promise.resolve();

    expect(appHost.textContent).toContain('2'); // cleared
    expect(appHost.textContent).toContain('held back for review');
  });
});
