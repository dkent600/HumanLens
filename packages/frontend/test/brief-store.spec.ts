import { describe, it, expect } from 'vitest';
import { DI, Registration } from 'aurelia';
import { LoggerConfiguration, LogLevel } from '@aurelia/kernel';
import type { ClientSafeFinding } from '@humanlens/shared';
import { BriefStore, groupByLens } from '../src/stores/brief-store';
import { IBriefApi } from '../src/seams/brief-api';
import { FakeBriefApi } from '../src/seams/brief-api.fake';

function finding(partial: Partial<ClientSafeFinding> & Pick<ClientSafeFinding, 'findingId' | 'lens'>): ClientSafeFinding {
  return {
    verbatim: 'a surfaced voice',
    noticing: null,
    evidenceLinks: ['u1'],
    support: { sourceCount: 1, unitCount: 1 },
    findingKind: 'ordinary',
    ...partial,
  };
}

function storeWith(api: IBriefApi): BriefStore {
  const container = DI.createContainer();
  container.register(
    LoggerConfiguration.create({ level: LogLevel.warn }),
    Registration.instance(IBriefApi, api),
    Registration.singleton(BriefStore, BriefStore),
  );
  return container.get(BriefStore);
}

describe('groupByLens — structural derivation', () => {
  it('groups findings by lens, preserving first-seen order', () => {
    const groups = groupByLens([
      finding({ findingId: 'listening:0', lens: 'listening' }),
      finding({ findingId: 'tension:0', lens: 'tension' }),
      finding({ findingId: 'listening:1', lens: 'listening' }),
    ]);
    expect(groups.map((g) => g.lens)).toEqual(['listening', 'tension']);
    expect(groups[0].roots.map((n) => n.finding.findingId)).toEqual(['listening:0', 'listening:1']);
  });

  it('nests a subtheme under its parent within a lens group', () => {
    const groups = groupByLens([
      finding({ findingId: 'listening:0', lens: 'listening' }),
      finding({ findingId: 'listening:1', lens: 'listening', parent: 'listening:0' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].roots.map((n) => n.finding.findingId)).toEqual(['listening:0']);
    expect(groups[0].roots[0].children.map((n) => n.finding.findingId)).toEqual(['listening:1']);
  });
});

describe('BriefStore.load', () => {
  it('moves to loaded and groups the client-safe findings on success', async () => {
    const store = storeWith(
      new FakeBriefApi({
        ok: true,
        brief: {
          engagementId: 'eng:x',
          findings: [finding({ findingId: 'listening:0', lens: 'listening' })],
        },
      }),
    );

    await store.load('eng:x');

    expect(store.status).toBe('loaded');
    expect(store.reason).toBeNull();
    expect(store.engagementId).toBe('eng:x');
    expect(store.groups.map((g) => g.lens)).toEqual(['listening']);
  });

  it('moves to error and records the reason when the brief is not found', async () => {
    const store = storeWith(new FakeBriefApi({ ok: false, reason: 'not-found' }));

    await store.load('eng:x');

    expect(store.status).toBe('error');
    expect(store.reason).toBe('not-found');
    expect(store.groups).toHaveLength(0);
  });

  it('surfaces a denied outcome as error state (dormant in V1, but wired)', async () => {
    const store = storeWith(new FakeBriefApi({ ok: false, reason: 'denied' }));

    await store.load('eng:x');

    expect(store.status).toBe('error');
    expect(store.reason).toBe('denied');
  });
});
