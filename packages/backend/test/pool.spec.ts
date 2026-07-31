import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  POOL_VERSION,
  PoolError,
  checkPoolStaleness,
  describePoolGaps,
  fingerprint,
  fixtureFingerprint,
  loadPool,
  parsePool,
  poolExists,
  poolPath,
  providerKind,
  savePool,
  summarizeStates,
  type FrozenPool,
  type PoolConditions,
  type PoolStateCounts,
} from '../src/eval/pool.js';
import type { Finding } from '../src/domain/finding.js';
import type { TerminalObservation } from '../src/engine/completeness/terminal-state.js';
import type { Unit } from '../src/domain/types.js';

// The frozen pool is CAPTURED EVIDENCE, paid for once and compared against days later. Its
// guarantees are therefore stricter than a lens's: a lens tolerates bad model output by
// dropping it, but anything wrong with a pool must REFUSE rather than degrade — a silently
// wrong pool turns every measurement taken against it into a false claim.
//
// Three things these tests exist to hold:
//   1. The load boundary RE-ESTABLISHES invariants rather than laundering them. JSON is
//      untyped; `as Finding[]` would walk a zero-anchor "ordinary" finding straight past the
//      compiler into a pipeline whose premise is that ordinary findings are evidence-anchored.
//   2. Effort refuses, max_tokens warns — they are NOT alike (see the staleness block).
//   3. Culture Pattern's prompt is NOT provenance. Comparing an incumbent prompt against a
//      rewrite on the same pool is the whole point; recording it would self-invalidate.

const CLEAN_COUNTS: PoolStateCounts = {
  answeredWithFindings: 2,
  answeredEmpty: 0,
  deliveredButUnusable: 0,
  failed: 0,
  invariantViolations: 0,
};

function surfacing(findingId: string, unitId: string): Finding {
  return {
    findingId,
    lens: 'listening',
    findingKind: 'ordinary',
    verbatim: `voice ${findingId}`,
    noticing: null,
    evidenceLinks: [unitId],
    supportSet: { sourceCount: 1, unitCount: 1 },
    sensitivity: 'normal',
    clearedToClientSafe: false,
  };
}

function interpretive(findingId: string, unitId: string): Finding {
  return {
    findingId,
    lens: 'meaning',
    findingKind: 'ordinary',
    verbatim: null,
    noticing: `a meaning for ${findingId}`,
    evidenceLinks: [unitId],
    supportSet: { sourceCount: 1, unitCount: 1 },
    sensitivity: 'normal',
    clearedToClientSafe: false,
  };
}

function pool(overrides: Partial<FrozenPool> = {}): FrozenPool {
  const findings = overrides.findings ?? [surfacing('listening:0-0', 'u1'), interpretive('meaning:0-0', 'u1')];
  return {
    poolVersion: POOL_VERSION,
    name: 'test-pool',
    capturedAt: '2026-07-31T00:00:00.000Z',
    provenance: {
      providerChoice: 'real',
      model: 'claude-opus-5',
      maxTokens: 64000,
      effort: 'high',
      fixtureFingerprint: 'sha256:fixture0000000000',
      upstreamPrompts: { listening: 'sha256:listening00000000', meaning: 'sha256:meaning0000000000' },
      counts: { listening: 1, meaning: 1, total: findings.length },
      terminalStates: { listening: CLEAN_COUNTS, meaning: CLEAN_COUNTS },
      ...overrides.provenance,
    },
    findings,
    ...overrides,
  } as FrozenPool;
}

/** The conditions matching the default pool — mutate one field per staleness test. */
function conditions(overrides: Partial<PoolConditions> = {}): PoolConditions {
  return {
    providerChoice: 'real',
    model: 'claude-opus-5',
    maxTokens: 64000,
    effort: 'high',
    fixtureFingerprint: 'sha256:fixture0000000000',
    upstreamPrompts: { listening: 'sha256:listening00000000', meaning: 'sha256:meaning0000000000' },
    ...overrides,
  };
}

/** Round-trip through JSON, as a real load does — undefined fields drop, types widen. */
function roundTrip(p: FrozenPool): unknown {
  return JSON.parse(JSON.stringify(p));
}

describe('frozen pool — the validating load boundary', () => {
  it('round-trips a valid pool through JSON unchanged', () => {
    const original = pool();
    expect(parsePool(roundTrip(original), 'test-pool')).toEqual(original);
  });

  it('REFUSES an ordinary finding with zero anchors — the NonEmpty guarantee is re-established, not laundered', () => {
    const broken = roundTrip(pool({ findings: [{ ...surfacing('listening:0-0', 'u1'), evidenceLinks: [] } as unknown as Finding] }));
    expect(() => parsePool(broken, 'p')).toThrow(PoolError);
    expect(() => parsePool(broken, 'p')).toThrow(/must cite at least one unit/);
  });

  it('REFUSES a Model B violation — both verbatim and noticing carrying text', () => {
    const both = roundTrip(
      pool({ findings: [{ ...surfacing('listening:0-0', 'u1'), noticing: 'also a noticing' } as unknown as Finding] }),
    );
    expect(() => parsePool(both, 'p')).toThrow(/exactly one of verbatim \/ noticing/);
  });

  it('REFUSES a Model B violation — neither carrying text', () => {
    const neither = roundTrip(
      pool({ findings: [{ ...surfacing('listening:0-0', 'u1'), verbatim: null } as unknown as Finding] }),
    );
    expect(() => parsePool(neither, 'p')).toThrow(/exactly one of verbatim \/ noticing/);
  });

  it('REFUSES an absence finding that carries anchors (its exemption is the reason it has none)', () => {
    const bad = roundTrip(
      pool({
        findings: [
          {
            findingId: 'x:0',
            lens: 'culture',
            findingKind: 'absence',
            verbatim: null,
            noticing: null,
            evidenceLinks: ['u1'],
            supportSet: { sourceCount: 0, unitCount: 0 },
            sensitivity: 'normal',
            clearedToClientSafe: false,
          } as unknown as Finding,
        ],
      }),
    );
    expect(() => parsePool(bad, 'p')).toThrow(/must have no evidence links/);
  });

  it('REFUSES when the recorded total disagrees with the findings actually present', () => {
    const p = pool();
    const tampered = roundTrip({ ...p, provenance: { ...p.provenance, counts: { listening: 1, meaning: 1, total: 99 } } } as FrozenPool);
    expect(() => parsePool(tampered, 'p')).toThrow(/total is 99 but 2 findings are present/);
  });

  it('REFUSES duplicate findingIds — the audit dedupes by id, so duplicates would shrink the denominator', () => {
    const dup = roundTrip(pool({ findings: [surfacing('same:0', 'u1'), surfacing('same:0', 'u2')] }));
    expect(() => parsePool(dup, 'p')).toThrow(/duplicate findingIds/);
  });

  it('REFUSES an unknown lens id and an unknown sensitivity', () => {
    const badLens = roundTrip(pool({ findings: [{ ...surfacing('a:0', 'u1'), lens: 'nonesuch' } as unknown as Finding] }));
    expect(() => parsePool(badLens, 'p')).toThrow(/is not a known lens id/);
    const badSens = roundTrip(pool({ findings: [{ ...surfacing('a:0', 'u1'), sensitivity: 'spicy' } as unknown as Finding] }));
    expect(() => parsePool(badSens, 'p')).toThrow(/is not a known sensitivity/);
  });

  it('REFUSES translation without sourceLanguage — they travel as a pair or not at all', () => {
    const lone = roundTrip(pool({ findings: [{ ...surfacing('a:0', 'u1'), translation: 'rendered' } as unknown as Finding] }));
    expect(() => parsePool(lone, 'p')).toThrow(/both be present or both absent/);
  });

  it('preserves a translation PAIR through the round trip', () => {
    const withPair = pool({
      findings: [{ ...surfacing('a:0', 'u1'), translation: 'rendered', sourceLanguage: 'Spanish' } as Finding],
    });
    const parsed = parsePool(roundTrip(withPair), 'p');
    expect(parsed.findings[0].translation).toBe('rendered');
    expect(parsed.findings[0].sourceLanguage).toBe('Spanish');
  });

  it('REFUSES malformed shapes outright rather than degrading to a default', () => {
    expect(() => parsePool(null, 'p')).toThrow(PoolError);
    expect(() => parsePool({}, 'p')).toThrow(PoolError);
    expect(() => parsePool({ poolVersion: 1, name: 'p', capturedAt: 'x' }, 'p')).toThrow(PoolError);
  });
});

describe('frozen pool — staleness', () => {
  it('accepts a pool captured under identical conditions', () => {
    expect(checkPoolStaleness(pool(), conditions())).toEqual([]);
  });

  it('EFFORT mismatch REFUSES — it is the thinking-depth control, so the pool is different data', () => {
    const issues = checkPoolStaleness(pool(), conditions({ effort: 'xhigh' }));
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('refuse');
    expect(issues[0].field).toBe('effort');
  });

  it('MAX_TOKENS mismatch only WARNS — a ceiling cannot change how much the model thought', () => {
    const issues = checkPoolStaleness(pool(), conditions({ maxTokens: 16000 }));
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warn');
    expect(issues[0].field).toBe('maxTokens');
  });

  it('REFUSES on model, fixture, and either upstream prompt', () => {
    for (const [field, cond] of [
      ['model', conditions({ model: 'claude-opus-4-8' })],
      ['fixtureFingerprint', conditions({ fixtureFingerprint: 'sha256:changed' })],
      ['upstreamPrompts.listening', conditions({ upstreamPrompts: { listening: 'sha256:changed', meaning: 'sha256:meaning0000000000' } })],
      ['upstreamPrompts.meaning', conditions({ upstreamPrompts: { listening: 'sha256:listening00000000', meaning: 'sha256:changed' } })],
    ] as const) {
      const refusals = checkPoolStaleness(pool(), cond).filter((i) => i.severity === 'refuse');
      expect(refusals.map((i) => i.field)).toEqual([field]);
    }
  });

  it('REFUSES a fake-captured pool against a real run — a category error, not drift', () => {
    const fakePool = pool({ provenance: { ...pool().provenance, providerChoice: 'fake-forced' } } as Partial<FrozenPool>);
    const refusals = checkPoolStaleness(fakePool, conditions({ providerChoice: 'real' })).filter((i) => i.severity === 'refuse');
    expect(refusals.map((i) => i.field)).toContain('providerKind');
  });

  it('treats fake-forced and fake-no-key as the SAME kind — both are the fake, however chosen', () => {
    expect(providerKind('fake-forced')).toBe('fake');
    expect(providerKind('fake-no-key')).toBe('fake');
    expect(providerKind('real')).toBe('real');
    const forced = pool({ provenance: { ...pool().provenance, providerChoice: 'fake-forced' } } as Partial<FrozenPool>);
    const issues = checkPoolStaleness(forced, conditions({ providerChoice: 'fake-no-key' }));
    expect(issues.filter((i) => i.field === 'providerKind')).toEqual([]);
  });

  it('REFUSES a pool written in a different format version', () => {
    const old = pool({ poolVersion: 0 });
    const refusals = checkPoolStaleness(old, conditions()).filter((i) => i.severity === 'refuse');
    expect(refusals.map((i) => i.field)).toContain('poolVersion');
  });

  it('THE ASYMMETRY: Culture Pattern is NOT part of provenance, so its prompt can change freely', () => {
    // Comparing an incumbent Culture prompt against a rewrite on the SAME pool is the entire
    // purpose. Recording Culture's prompt would make every such comparison self-invalidating.
    const keys = Object.keys(pool().provenance);
    expect(keys).not.toContain('culture');
    expect(Object.keys(pool().provenance.upstreamPrompts).sort()).toEqual(['listening', 'meaning']);
  });
});

describe('frozen pool — capture-time gaps must never look clean', () => {
  const gappy = (counts: Partial<PoolStateCounts>): FrozenPool => {
    const base = pool();
    return {
      ...base,
      provenance: {
        ...base.provenance,
        terminalStates: { listening: { ...CLEAN_COUNTS, ...counts }, meaning: CLEAN_COUNTS },
      },
    };
  };

  it('says nothing when every voice answered', () => {
    expect(describePoolGaps(pool())).toEqual([]);
  });

  it('reports voices that produced NO finding — they are absent from the pool, invisible in a total', () => {
    const lines = describePoolGaps(gappy({ deliveredButUnusable: 2, failed: 1 }));
    expect(lines.join('\n')).toMatch(/listening: 3 voice\(s\) produced NO finding/);
    expect(lines.join('\n')).toMatch(/MISSING from this pool/);
  });

  it('reports capture-time invariant violations separately', () => {
    expect(describePoolGaps(gappy({ invariantViolations: 2 })).join('\n')).toMatch(/2 completeness-invariant violation/);
  });

  it('summarizeStates tallies the four states and the violations', () => {
    const obs = new Map<string, TerminalObservation<unknown>>([
      ['a', { state: 'answered-with-findings', reasonCode: 'ok', findings: [1], quarantined: [] }],
      ['b', { state: 'answered-empty', reasonCode: 'chosen-empty', findings: [], quarantined: [], invariantViolation: 'x' }],
      ['c', { state: 'delivered-but-unusable', reasonCode: 'malformed', findings: [], quarantined: [] }],
      ['d', { state: 'failed', reasonCode: 'transport', findings: [], quarantined: [] }],
    ]);
    expect(summarizeStates(obs)).toEqual({
      answeredWithFindings: 1,
      answeredEmpty: 1,
      deliveredButUnusable: 1,
      failed: 1,
      invariantViolations: 1,
    });
  });
});

describe('frozen pool — persistence', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'humanlens-pool-'));
  });
  afterAll(async () => {
    // Best-effort only; the OS temp dir is self-managing and a failure here must not fail a run.
  });

  it('writes and reads a pool back identically', async () => {
    const p = pool({ name: 'roundtrip' });
    const written = await savePool(p, { dir });
    expect(written).toBe(poolPath('roundtrip', dir));
    expect(await loadPool('roundtrip', dir)).toEqual(p);
  });

  it('poolExists answers BEFORE the expensive work — the guard that saves ~80 paid calls', async () => {
    // savePool also refuses, but only after the pool has been built and paid for. Capture
    // calls this first so a mistyped name costs nothing.
    expect(await poolExists('never-captured', dir)).toBe(false);
    await savePool(pool({ name: 'already-here' }), { dir });
    expect(await poolExists('already-here', dir)).toBe(true);
  });

  it('REFUSES to overwrite an existing pool — it would unmoor every measurement already taken', async () => {
    const p = pool({ name: 'precious' });
    await savePool(p, { dir });
    await expect(savePool(p, { dir })).rejects.toThrow(/Refusing to overwrite/);
    // and the original is untouched
    expect(await loadPool('precious', dir)).toEqual(p);
  });

  it('overwrites only with an explicit opt-in', async () => {
    const first = pool({ name: 'replaceable' });
    await savePool(first, { dir });
    const second = pool({ name: 'replaceable', capturedAt: '2026-08-01T00:00:00.000Z' });
    await savePool(second, { dir, overwrite: true });
    expect((await loadPool('replaceable', dir)).capturedAt).toBe('2026-08-01T00:00:00.000Z');
  });

  it('gives an actionable error for a missing pool', async () => {
    await expect(loadPool('nonesuch', dir)).rejects.toThrow(/no pool named "nonesuch"/);
  });

  it('REFUSES a corrupted pool file rather than returning a partial one', async () => {
    await writeFile(path.join(dir, 'corrupt.json'), '{ not json', 'utf8');
    await expect(loadPool('corrupt', dir)).rejects.toThrow(/not valid JSON/);
  });

  it('validates on LOAD, not just on parse — a hand-edited file cannot smuggle a bad finding in', async () => {
    const p = pool({ name: 'edited' });
    await savePool(p, { dir });
    const onDisk = JSON.parse(await readFile(poolPath('edited', dir), 'utf8')) as { findings: unknown[] };
    (onDisk.findings[0] as { evidenceLinks: string[] }).evidenceLinks = [];
    await writeFile(poolPath('edited', dir), JSON.stringify(onDisk), 'utf8');
    await expect(loadPool('edited', dir)).rejects.toThrow(/must cite at least one unit/);
  });
});

describe('frozen pool — fingerprints', () => {
  const unit = (unitId: string, content: string): Unit => ({
    unitId,
    engagementId: 'eng:1',
    ingestedBy: 'actor:test',
    ingestedAt: '2026-01-01T00:00:00.000Z',
    sourceRef: 'src',
    position: 0,
    language: 'en',
    content,
    deidStatus: 'cleared',
    speakerToken: 'spk-a',
  });

  it('is stable for identical input and differs for changed CONTENT, not just ids', () => {
    const a = [unit('u1', 'the workload is heavy')];
    expect(fixtureFingerprint(a)).toBe(fixtureFingerprint([unit('u1', 'the workload is heavy')]));
    // A reworded unit produces different upstream findings even though its id is unchanged.
    expect(fixtureFingerprint(a)).not.toBe(fixtureFingerprint([unit('u1', 'the workload is light')]));
    expect(fixtureFingerprint(a)).not.toBe(fixtureFingerprint([unit('u2', 'the workload is heavy')]));
  });

  it('fingerprints prompt text deterministically', () => {
    expect(fingerprint('abc')).toBe(fingerprint('abc'));
    expect(fingerprint('abc')).not.toBe(fingerprint('abd'));
    expect(fingerprint('abc')).toMatch(/^sha256:[0-9a-f]{16}$/);
  });
});
