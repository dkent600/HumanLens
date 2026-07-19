import { describe, expect, it } from 'vitest';
import { CulturePatternLens } from '../src/engine/lenses/culture-pattern-lens.js';
import { FakeLlmProvider, type LensResponsePayload } from '../src/seams/llm-provider.js';
import { runCrossVoiceLens } from '../src/engine/completeness/cross-voice-lens.js';
import { isEvidenceAnchored, makeOrdinaryFinding, type Finding } from '../src/domain/finding.js';
import type { Unit } from '../src/domain/types.js';

// Culture Pattern is the first REAL cross-voice lens: it reads the whole prior-finding set in
// ONE call and emits patterns across it, each CITING (sourceFindingIds, plural) the findings it
// is built on. Its anchor is inherited from the union of the cited findings' units, and the
// cited-or-residual audit runs after the call. v1 has no absence findings, so a pattern citing
// ZERO existing findings is a defect — recorded and surfaced (uncitedDefects), never emitted.

function clearedUnit(unitId: string, speakerToken: string): Unit {
  return {
    unitId,
    engagementId: 'eng:1',
    ingestedBy: 'actor:test',
    ingestedAt: '2026-01-01T00:00:00.000Z',
    sourceRef: 'src',
    position: 0,
    language: 'en',
    content: `content for ${unitId}`,
    deidStatus: 'cleared',
    speakerToken,
  };
}

const units: readonly Unit[] = [clearedUnit('u1', 'spk-a'), clearedUnit('u2', 'spk-b'), clearedUnit('u3', 'spk-c')];

/** An Evidence-wave finding to feed the Culture Pattern lens as a delivered voice. */
function evidenceFinding(findingId: string, evidenceLinks: readonly string[]): Finding {
  return makeOrdinaryFinding({ findingId, lens: 'listening', verbatim: 'a surfaced voice', evidenceLinks, units });
}

const prior: readonly Finding[] = [
  evidenceFinding('listening:0', ['u1']),
  evidenceFinding('listening:1', ['u2']),
  evidenceFinding('listening:2', ['u3']),
];

/** A fake emitting the given pattern candidates (noticing + the finding ids each cites). */
function patternsProvider(
  patterns: readonly { noticing: string; sourceFindingIds: readonly string[] }[],
): FakeLlmProvider {
  return new FakeLlmProvider(
    (): LensResponsePayload => ({ findings: patterns.map((p) => ({ ...p, evidenceUnitIds: [] })) }),
  );
}

describe('Culture Pattern lens — real cross-voice lens', () => {
  it('stays silent when there are no prior findings to pattern across', async () => {
    const out = await new CulturePatternLens().run(units, [], new FakeLlmProvider());
    expect(out).toHaveLength(0);
  });

  it('emits a pattern ACROSS voices, anchored to the union of the units behind the findings it cites', async () => {
    const provider = patternsProvider([
      { noticing: 'a shared pressure across two voices', sourceFindingIds: ['listening:0', 'listening:1'] },
    ]);
    const out = await new CulturePatternLens().run(units, prior, provider);

    expect(out).toHaveLength(1);
    const [pattern] = out;
    expect(pattern.lens).toBe('culture');
    expect(pattern.findingId).toBe('culture:0');
    expect(pattern.noticing).not.toBeNull();
    expect(isEvidenceAnchored(pattern)).toBe(true);
    // Anchor = union of listening:0's unit (u1) and listening:1's unit (u2) — NOT u3.
    expect([...pattern.evidenceLinks].sort()).toEqual(['u1', 'u2']);
    expect(pattern.supportSet).toEqual({ sourceCount: 2, unitCount: 2 }); // derived, honest
    expect(pattern.clearedToClientSafe).toBe(false); // held by default
  });

  it('records a DEFECT — a pattern citing zero existing findings is surfaced, never emitted, never retried', async () => {
    // One valid pattern + two defective ones: one cites nothing, one cites only a hallucinated id.
    const provider = patternsProvider([
      { noticing: 'a real pattern', sourceFindingIds: ['listening:0', 'listening:1'] },
      { noticing: 'a groundless assertion', sourceFindingIds: [] },
      { noticing: 'cites only a made-up id', sourceFindingIds: ['listening:999'] },
    ]);
    const { findings, cited } = await new CulturePatternLens().synthesize(units, prior, provider);

    expect(findings.map((f) => f.findingId)).toEqual(['culture:0']); // only the valid pattern emitted
    // The valid pattern's citations are the audit's cited set; the defects contribute nothing here.
    expect([...cited].sort()).toEqual(['listening:0', 'listening:1']);
  });

  it('surfaces the defects via runCrossVoiceLens (uncitedDefects) and keeps the valid pattern', async () => {
    const provider = patternsProvider([
      { noticing: 'a real pattern', sourceFindingIds: ['listening:0', 'listening:1'] },
      { noticing: 'a groundless assertion', sourceFindingIds: [] },
      { noticing: 'cites only a made-up id', sourceFindingIds: ['listening:999'] },
    ]);
    const { findings, audit, uncitedDefects } = await runCrossVoiceLens(new CulturePatternLens(), units, prior, provider);

    expect(findings).toHaveLength(1);
    expect(uncitedDefects).toEqual(['a groundless assertion', 'cites only a made-up id']); // both defects surfaced
    // The audit sees the valid pattern's citations: listening:2 was never cited -> residual.
    expect(audit.cited).toEqual(['listening:0', 'listening:1']);
    expect(audit.residual).toEqual(['listening:2']); // expected non-empty residual, not a failure
    expect(audit.coverageRatio).toBeCloseTo(2 / 3);
  });

  it('quarantines a hallucinated id mixed into an otherwise-valid citation (finding kept)', async () => {
    const provider = patternsProvider([
      { noticing: 'a real pattern with a stray cite', sourceFindingIds: ['listening:0', 'listening:404'] },
    ]);
    const { findings, audit } = await runCrossVoiceLens(new CulturePatternLens(), units, prior, provider);

    expect(findings).toHaveLength(1); // the pattern is kept; only the bad ID is quarantined
    expect(findings[0].evidenceLinks).toEqual(['u1']); // anchored to the valid citation's unit
    expect(audit.cited).toEqual(['listening:0']);
    expect(audit.quarantined).toEqual(['listening:404']);
  });

  it('is deterministic — same prior findings and citations yield the same output', async () => {
    const provider = () => patternsProvider([{ noticing: 'a pattern', sourceFindingIds: ['listening:0', 'listening:2'] }]);
    const a = await new CulturePatternLens().run(units, prior, provider());
    const b = await new CulturePatternLens().run(units, prior, provider());
    expect(a).toEqual(b);
  });
});
