import { describe, it, expect } from 'vitest';
import { createFixture } from '@aurelia/testing';
import { Registration } from 'aurelia';
import { LoggerConfiguration, LogLevel } from '@aurelia/kernel';
import { BriefPage } from '../src/pages/brief-page';
import { BriefStore } from '../src/stores/brief-store';
import { SupportTextValueConverter } from '../src/resources/support-text';
import { IBriefApi } from '../src/seams/brief-api';
import { FakeBriefApi } from '../src/seams/brief-api.fake';

// The round-trip with no server: Service (fake) -> Store -> view-model -> view.

describe('brief-page', () => {
  it('renders the client-safe findings grouped by lens, with derived support', async () => {
    const fake = new FakeBriefApi({
      ok: true,
      brief: {
        engagementId: 'eng:x',
        findings: [
          {
            findingId: 'listening:0',
            lens: 'listening',
            verbatim: 'A recurring signal runs across the comments.',
            noticing: null,
            evidenceLinks: ['u1', 'u2'],
            support: { sourceCount: 2, unitCount: 2 },
            findingKind: 'ordinary',
          },
          {
            findingId: 'listening:1',
            lens: 'listening',
            verbatim: 'No me siento seguro',
            noticing: null,
            translation: 'I do not feel safe',
            sourceLanguage: 'Spanish',
            evidenceLinks: ['u3'],
            support: { sourceCount: 1, unitCount: 1 },
            findingKind: 'ordinary',
          },
          {
            // An interpretive finding — its text lives in `noticing`, verbatim null.
            findingId: 'meaning:0',
            lens: 'meaning',
            verbatim: null,
            noticing: 'a signal of eroding trust in leadership',
            evidenceLinks: ['u1'],
            support: { sourceCount: 1, unitCount: 1 },
            findingKind: 'ordinary',
          },
        ],
      },
    });

    const { appHost, container } = await createFixture(
      '<brief-page></brief-page>',
      {},
      [
        BriefPage,
        SupportTextValueConverter,
        Registration.instance(IBriefApi, fake),
        Registration.singleton(BriefStore, BriefStore),
        LoggerConfiguration.create({ level: LogLevel.warn }),
      ],
    ).started;

    // binding() fired the load; await it deterministically on the same singleton, then
    // let the render flush.
    await container.get(BriefStore).load('eng:x');
    await Promise.resolve();

    expect(appHost.textContent).toContain('A recurring signal runs across the comments.');
    expect(appHost.textContent).toContain('appears in 2 comments across 2 sources');
    // The non-English finding shows the original verbatim, the translation, and the flag.
    expect(appHost.textContent).toContain('No me siento seguro');
    expect(appHost.textContent).toContain('I do not feel safe');
    expect(appHost.textContent).toContain('translated from Spanish');
    // An interpretive finding renders its `noticing` (verbatim null): noticing ?? verbatim.
    expect(appHost.textContent).toContain('a signal of eroding trust in leadership');
  });

  it('renders a not-found message when the brief is unavailable', async () => {
    const fake = new FakeBriefApi({ ok: false, reason: 'not-found' });

    const { appHost, container } = await createFixture(
      '<brief-page></brief-page>',
      {},
      [
        BriefPage,
        SupportTextValueConverter,
        Registration.instance(IBriefApi, fake),
        Registration.singleton(BriefStore, BriefStore),
        LoggerConfiguration.create({ level: LogLevel.warn }),
      ],
    ).started;

    await container.get(BriefStore).load('eng:x');
    await Promise.resolve();

    expect(appHost.textContent).toContain('No brief found');
  });
});
