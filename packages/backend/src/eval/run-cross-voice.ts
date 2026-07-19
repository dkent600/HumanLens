import type { Unit } from '../domain/types.js';
import { makeOrdinaryFinding, type Finding } from '../domain/finding.js';
import {
  FakeLlmProvider,
  type LensPromptPayload,
  type LensResponsePayload,
  type LlmProvider,
} from '../seams/llm-provider.js';
import { toPromptFinding } from '../engine/lenses/prompt-projection.js';
import {
  collectCitations,
  runCrossVoiceLens,
  type CrossVoiceLens,
  type CrossVoiceSynthesis,
} from '../engine/completeness/cross-voice-lens.js';
import { formatCitationAudit } from '../engine/completeness/cross-voice-audit.js';

// Dev / demonstration harness for the CROSS-VOICE cited-or-residual audit — the manual path
// for eyeballing how a cross-voice lens's citations partition the delivered set into cited
// vs residual, the same way run-lens.ts prints the per-voice ledger. It is NOT part of the
// server. It drives a DEMO cross-voice lens on the FAKE provider (no real model), so the
// mechanism is visible without the real Culture Pattern / Tension prompts (a separate
// increment). A real cross-voice lens implements CrossVoiceLens the same way.
//
//   Build + run (from packages/backend):  npm run cross-voice

/** Synthetic units + one Listening finding each — the closed delivered set for the demo. */
function deliveredFindings(): { units: readonly Unit[]; findings: readonly Finding[] } {
  const units: Unit[] = [];
  const findings: Finding[] = [];
  for (let i = 0; i < 6; i += 1) {
    const unit: Unit = {
      unitId: `u${i}`,
      engagementId: 'eng:demo',
      ingestedBy: 'actor:demo',
      ingestedAt: '2026-01-01T00:00:00.000Z',
      sourceRef: 'demo',
      position: i,
      language: 'en',
      content: `demo voice ${i}`,
      deidStatus: 'cleared',
      speakerToken: `spk-${i}`,
    };
    units.push(unit);
    findings.push(
      makeOrdinaryFinding({ findingId: `listening:${i}-0`, lens: 'listening', verbatim: `voice ${i}`, evidenceLinks: [`u${i}`], units }),
    );
  }
  return { units, findings };
}

/**
 * A DEMO cross-voice lens. It emits patterns citing (via `sourceFindingIds`) the finding ids
 * each is built on — and deliberately leaves some findings uncited (→ residual) and cites one
 * id that was never delivered (→ quarantined), so the audit's behavior is visible.
 */
class DemoCrossVoiceLens implements CrossVoiceLens {
  readonly id = 'culture';

  constructor(private readonly units: readonly Unit[]) {}

  deliveredFindingIds(priorFindings: readonly Finding[]): readonly string[] {
    return priorFindings.map((f) => f.findingId);
  }

  async synthesize(priorFindings: readonly Finding[], provider: LlmProvider): Promise<CrossVoiceSynthesis> {
    const payload: LensPromptPayload = {
      instruction: 'Surface patterns across the prior findings; each pattern cites the finding ids it draws on.',
      units: [],
      priorFindings: priorFindings.map(toPromptFinding),
    };
    const response = await provider.complete({ prompt: JSON.stringify(payload) });
    const parsed = JSON.parse(response.text) as LensResponsePayload;

    const bySourceId = new Map(priorFindings.map((f) => [f.findingId, f]));
    const findings: Finding[] = [];
    parsed.findings.forEach((candidate, index) => {
      const citedIds = candidate.sourceFindingIds ?? [];
      // A pattern anchors to the union of units behind the (in-scope) findings it cites.
      const anchorUnits = [
        ...new Set(citedIds.flatMap((id) => [...(bySourceId.get(id)?.evidenceLinks ?? [])])),
      ];
      if (candidate.noticing === undefined || anchorUnits.length === 0) return;
      findings.push(
        makeOrdinaryFinding({
          findingId: `${this.id}:${index}`,
          lens: 'culture',
          noticing: candidate.noticing,
          evidenceLinks: anchorUnits,
          units: this.units,
        }),
      );
    });
    return { findings, cited: collectCitations(parsed.findings) };
  }
}

/** A fake that emits two patterns: one cites u0/u1, one cites u2 + a hallucinated id. */
function demoProvider(): FakeLlmProvider {
  return new FakeLlmProvider(
    (): LensResponsePayload => ({
      findings: [
        { noticing: 'a shared pressure across two voices', sourceFindingIds: ['listening:0-0', 'listening:1-0'], evidenceUnitIds: [] },
        { noticing: 'a trust signal, plus a stray citation', sourceFindingIds: ['listening:2-0', 'listening:99-0'], evidenceUnitIds: [] },
      ],
    }),
  );
}

async function main(): Promise<void> {
  const { units, findings: delivered } = deliveredFindings();
  const lens = new DemoCrossVoiceLens(units);

  console.log('Cross-voice cited-or-residual audit — demonstration (fake provider, DEMO lens)\n');
  console.log(`Delivered set (${delivered.length} findings): ${delivered.map((f) => f.findingId).join(', ')}\n`);

  const { findings, audit } = await runCrossVoiceLens(lens, delivered, demoProvider());

  console.log(`${findings.length} pattern(s) emitted:`);
  for (const f of findings) {
    console.log(`  [${f.findingId}] ${f.noticing}  (anchors: ${f.evidenceLinks.join(', ')})`);
  }
  console.log('');
  console.log(formatCitationAudit(lens.id, audit));
  console.log('');
  console.log('A non-empty residual is EXPECTED — it is uncited findings made visible for a human, not a failure.');
  console.log('The audit is a review diagnostic only; it is never fed back to the model as a citation target.');
}

await main();
