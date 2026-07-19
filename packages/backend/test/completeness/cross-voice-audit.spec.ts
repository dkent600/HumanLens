import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  computeCitationAudit,
  formatCitationAudit,
} from '../../src/engine/completeness/cross-voice-audit.js';
import {
  collectCitations,
  runCrossVoiceLens,
  type CrossVoiceLens,
  type CrossVoiceSynthesis,
} from '../../src/engine/completeness/cross-voice-lens.js';
import type { LensResponseCandidate, LlmProvider } from '../../src/seams/llm-provider.js';
import { makeOrdinaryFinding, type Finding } from '../../src/domain/finding.js';
import type { Unit } from '../../src/domain/types.js';

// The CROSS-VOICE cited-or-residual audit. The load-bearing guarantee: every delivered
// finding ends either cited or in the residual — never neither, never both — and a
// hallucinated citation (an id never delivered) is quarantined and covers nothing (the P3
// provenance discipline, one path over). A non-empty residual is expected and correct.

const SEED_PARTITION = 5_905_001;

describe('computeCitationAudit — the cited-or-residual partition', () => {
  it('partitions the delivered set exactly: cited ∪ residual = delivered, disjoint', () => {
    const audit = computeCitationAudit(['a', 'b', 'c', 'd'], ['a', 'c']);
    expect(audit.cited).toEqual(['a', 'c']);
    expect(audit.residual).toEqual(['b', 'd']); // delivered − cited, order preserved
    expect(audit.quarantined).toEqual([]);
    expect(audit.coverageRatio).toBe(0.5);
  });

  it('a non-empty residual is just uncited findings — not an error (all uncited is valid)', () => {
    const audit = computeCitationAudit(['a', 'b'], []);
    expect(audit.cited).toEqual([]);
    expect(audit.residual).toEqual(['a', 'b']);
    expect(audit.coverageRatio).toBe(0);
  });

  it('quarantines a hallucinated cited id and does NOT let it reduce the residual', () => {
    // 'z' was never delivered. It must be quarantined, and must not "cover" anything —
    // residual stays exactly the genuinely-uncited delivered ids.
    const audit = computeCitationAudit(['a', 'b', 'c'], ['a', 'z']);
    expect(audit.cited).toEqual(['a']); // only the delivered citation counts
    expect(audit.residual).toEqual(['b', 'c']); // 'z' removed nothing beyond 'a'
    expect(audit.quarantined).toEqual(['z']);
    expect(audit.coverageRatio).toBeCloseTo(1 / 3);
  });

  it('an empty delivered set is fully covered (ratio 1, no residual)', () => {
    const audit = computeCitationAudit([], []);
    expect(audit.residual).toEqual([]);
    expect(audit.coverageRatio).toBe(1);
  });

  it('dedupes a repeated delivered id and repeated citations', () => {
    const audit = computeCitationAudit(['a', 'a', 'b'], ['a', 'a']);
    expect(audit.delivered).toEqual(['a', 'b']);
    expect(audit.cited).toEqual(['a']);
    expect(audit.residual).toEqual(['b']);
  });

  it('PROPERTY: delivered = cited ⊎ residual (partition); quarantined = cited − delivered; ratio = cited/delivered', () => {
    // A small id alphabet so delivered and cited overlap frequently.
    const idArb = fc.string({ minLength: 1, maxLength: 3 });
    fc.assert(
      fc.property(fc.array(idArb, { maxLength: 20 }), fc.array(idArb, { maxLength: 20 }), (delivered, cited) => {
        const audit = computeCitationAudit(delivered, cited);
        const deliveredSet = new Set(delivered);
        const citedRaw = new Set(cited);

        // Partition: every delivered id in EXACTLY ONE of cited / residual, never neither/both.
        expect(new Set([...audit.cited, ...audit.residual])).toEqual(deliveredSet);
        expect(audit.cited.length + audit.residual.length).toBe(deliveredSet.size);
        const citedSet = new Set(audit.cited);
        for (const r of audit.residual) expect(citedSet.has(r)).toBe(false);

        // Residual is EXACTLY delivered − cited.
        for (const id of deliveredSet) {
          if (citedRaw.has(id)) expect(audit.cited).toContain(id);
          else expect(audit.residual).toContain(id);
        }

        // Quarantined = cited − delivered; a hallucinated id never appears in cited or residual.
        for (const q of audit.quarantined) {
          expect(deliveredSet.has(q)).toBe(false);
          expect(audit.cited).not.toContain(q);
          expect(audit.residual).not.toContain(q);
        }

        const expectedRatio = deliveredSet.size === 0 ? 1 : audit.cited.length / deliveredSet.size;
        expect(audit.coverageRatio).toBe(expectedRatio);
      }),
      { numRuns: 2000, seed: SEED_PARTITION },
    );
  });
});

describe('collectCitations — union of sourceFindingIds across emitted candidates', () => {
  it('unions and dedupes the plural citations, ignoring candidates that cite none', () => {
    const candidates: LensResponseCandidate[] = [
      { noticing: 'p1', sourceFindingIds: ['a', 'b'], evidenceUnitIds: [] },
      { noticing: 'p2', sourceFindingIds: ['b', 'c'], evidenceUnitIds: [] },
      { noticing: 'p3', evidenceUnitIds: [] }, // cites nothing — contributes nothing
    ];
    expect(collectCitations(candidates).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('runCrossVoiceLens — one call over the whole set, then the audit', () => {
  function unit(id: string): Unit {
    return {
      unitId: id, engagementId: 'e', ingestedBy: 'a', ingestedAt: '2026-01-01T00:00:00.000Z',
      sourceRef: 's', position: 0, language: 'en', content: id, deidStatus: 'cleared', speakerToken: `spk-${id}`,
    };
  }
  const units = [unit('u0'), unit('u1'), unit('u2')];
  const delivered: Finding[] = units.map((u, i) =>
    makeOrdinaryFinding({ findingId: `listening:${i}-0`, lens: 'listening', verbatim: `v${i}`, evidenceLinks: [u.unitId], units }),
  );

  /** A stub cross-voice lens that cites the first two delivered ids + a hallucinated one. */
  const stubLens: CrossVoiceLens = {
    id: 'tension',
    deliveredFindingIds: (prior) => prior.map((f) => f.findingId),
    synthesize: (): Promise<CrossVoiceSynthesis> =>
      Promise.resolve({
        findings: [
          makeOrdinaryFinding({ findingId: 'tension:0', lens: 'tension', noticing: 'a tension', evidenceLinks: ['u0'], units }),
        ],
        cited: ['listening:0-0', 'listening:1-0', 'listening:404-0'],
        uncitedDefects: [],
      }),
  };

  it('audits the citations: cited/residual partition + quarantine, findings returned intact', async () => {
    const provider: LlmProvider = { complete: () => Promise.resolve({ text: '{}', stopReason: 'end_turn' }) };
    const { findings, audit } = await runCrossVoiceLens(stubLens, units, delivered, provider);

    expect(findings.map((f) => f.findingId)).toEqual(['tension:0']); // emitted patterns kept as-is
    expect(audit.delivered).toEqual(['listening:0-0', 'listening:1-0', 'listening:2-0']);
    expect(audit.cited).toEqual(['listening:0-0', 'listening:1-0']);
    expect(audit.residual).toEqual(['listening:2-0']); // never cited -> visible residual
    expect(audit.quarantined).toEqual(['listening:404-0']); // hallucinated citation
    expect(audit.coverageRatio).toBeCloseTo(2 / 3);
  });
});

describe('formatCitationAudit — inspectable surfacing', () => {
  it('renders the coverage ratio and the residual + quarantined contents', () => {
    const audit = computeCitationAudit(['a', 'b', 'c'], ['a', 'z']);
    const text = formatCitationAudit('culture', audit);
    expect(text).toContain('coverage 33%');
    expect(text).toContain('residual');
    expect(text).toContain('b, c');
    expect(text).toContain('z'); // quarantined shown
  });
});
