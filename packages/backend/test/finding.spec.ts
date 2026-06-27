import { describe, expect, it } from 'vitest';
import {
  deriveSupportSet,
  isEvidenceAnchored,
  makeAbsenceFinding,
  makeOrdinaryFinding,
  MissingVerbatimError,
  UnanchoredFindingError,
  UnpairedTranslationError,
} from '../src/domain/finding.js';

// Structural guards for the Finding's trust properties. These are regression
// guards: a future change that breaks evidence anchoring or lets strength be
// asserted should fail here.

const units = [
  { unitId: 'u1', speakerToken: 'spk-a' },
  { unitId: 'u2', speakerToken: 'spk-a' }, // same source as u1 (e.g. two interview passages)
  { unitId: 'u3', speakerToken: 'spk-b' },
];

describe('Finding — evidence anchoring', () => {
  it('an ordinary finding cannot be built without an anchor (runtime mirror of the type)', () => {
    expect(() =>
      makeOrdinaryFinding({
        findingId: 'listening:0',
        lens: 'listening',
        verbatim: 'a pattern with no evidence',
        evidenceLinks: [],
        units,
      }),
    ).toThrow(UnanchoredFindingError);
  });

  it('an ordinary finding with at least one anchor is allowed', () => {
    const finding = makeOrdinaryFinding({
      findingId: 'listening:0',
      lens: 'listening',
      verbatim: 'people raise workload',
      evidenceLinks: ['u1'],
      units,
    });
    expect(isEvidenceAnchored(finding)).toBe(true);
    expect(finding.evidenceLinks).toEqual(['u1']);
    expect(finding.verbatim).toBe('people raise workload');
    expect(finding.translation).toBeUndefined(); // English: no translation/sourceLanguage
  });

  it('the absence finding is the sanctioned exception — unanchored, yet valid', () => {
    const finding = makeAbsenceFinding({
      findingId: 'listening:abs',
      lens: 'listening',
    });
    expect(finding.evidenceLinks).toEqual([]);
    expect(isEvidenceAnchored(finding)).toBe(true);
    expect(finding.verbatim).toBeNull(); // no source to quote
  });
});

describe('Finding — strength is derived, not asserted', () => {
  it('support tracks the evidence set, counting distinct sources by speaker token', () => {
    // u1 + u2 share a speaker token => one source; u3 is a second source.
    const support = deriveSupportSet(['u1', 'u2', 'u3'], units);
    expect(support).toEqual({ sourceCount: 2, unitCount: 3 });
  });

  it('more distinct-source evidence raises the derived strength', () => {
    const narrow = makeOrdinaryFinding({
      findingId: 'listening:0',
      lens: 'listening',
      verbatim: 'theme',
      evidenceLinks: ['u1', 'u2'], // one source
      units,
    });
    const broad = makeOrdinaryFinding({
      findingId: 'listening:1',
      lens: 'listening',
      verbatim: 'theme',
      evidenceLinks: ['u1', 'u2', 'u3'], // two sources
      units,
    });
    expect(narrow.supportSet.sourceCount).toBe(1);
    expect(broad.supportSet.sourceCount).toBe(2);
  });

  it('there is no way to assert a strength — it always reflects the evidence handed in', () => {
    const finding = makeOrdinaryFinding({
      findingId: 'listening:0',
      lens: 'listening',
      verbatim: 'theme',
      evidenceLinks: ['u3'],
      units,
    });
    // The support is computed from the one cited unit, regardless of caller intent.
    expect(finding.supportSet).toEqual({ sourceCount: 1, unitCount: 1 });
  });
});

describe('Finding — disposition defaults to held', () => {
  it('a finding is internal-only until affirmatively promoted', () => {
    const finding = makeOrdinaryFinding({
      findingId: 'listening:0',
      lens: 'listening',
      verbatim: 'theme',
      evidenceLinks: ['u1'],
      units,
    });
    expect(finding.clearedToClientSafe).toBe(false);
    expect(finding.sensitivity).toBe('normal');
  });
});

describe('Finding — verbatim and the translation pair', () => {
  it('an ordinary finding cannot be built with empty verbatim (runtime mirror of the type)', () => {
    expect(() =>
      makeOrdinaryFinding({
        findingId: 'listening:0',
        lens: 'listening',
        verbatim: '   ', // whitespace-only is contentless
        evidenceLinks: ['u1'],
        units,
      }),
    ).toThrow(MissingVerbatimError);
  });

  it('carries a paired translation + sourceLanguage for a non-English finding', () => {
    const finding = makeOrdinaryFinding({
      findingId: 'listening:0',
      lens: 'listening',
      verbatim: 'No me siento seguro',
      translation: 'I do not feel safe',
      sourceLanguage: 'Spanish',
      evidenceLinks: ['u1'],
      units,
    });
    expect(finding.verbatim).toBe('No me siento seguro'); // original kept, untouched
    expect(finding.translation).toBe('I do not feel safe');
    expect(finding.sourceLanguage).toBe('Spanish');
  });

  it('rejects a lone translation or a lone sourceLanguage (they are a pair)', () => {
    const base = { findingId: 'listening:0', lens: 'listening' as const, evidenceLinks: ['u1'], units };
    expect(() =>
      makeOrdinaryFinding({ ...base, verbatim: 'x', translation: 'only translation' }),
    ).toThrow(UnpairedTranslationError);
    expect(() =>
      makeOrdinaryFinding({ ...base, verbatim: 'x', sourceLanguage: 'Spanish' }),
    ).toThrow(UnpairedTranslationError);
  });
});
