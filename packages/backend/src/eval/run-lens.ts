import type { Unit } from '../domain/types.js';
import type { Finding } from '../domain/finding.js';
import type { LlmProvider } from '../seams/llm-provider.js';
import { ANTHROPIC_MODEL } from '../seams/anthropic-llm-provider.js';
import { hasAnthropicKey, selectLlmProvider } from '../seams/select-llm-provider.js';
import { ListeningLens } from '../engine/lenses/listening-lens.js';
import { HumanMeaningLens } from '../engine/lenses/human-meaning-lens.js';
import { CulturePatternLens } from '../engine/lenses/culture-pattern-lens.js';
import { runPerVoiceLens } from '../engine/completeness/per-voice-lens.js';
import { runCrossVoiceLens } from '../engine/completeness/cross-voice-lens.js';
import { formatCitationAudit, type CitationAudit } from '../engine/completeness/cross-voice-audit.js';
import { SqliteRunLedger } from '../seams/sqlite-run-ledger.js';
import type { RunLedger } from '../seams/run-ledger.js';
import { SAMPLE_UNITS } from './sample-units.js';

// Dev / eval harness — the manual path for eyeballing REAL model output on ONE lens,
// the loop where a lens's prompt gets tuned. It is NOT part of the server: buildContainer
// and the running app stay on the fake; only this entry point selects the real provider.
//
//   Build + run (from packages/backend):  npm run eval -- listening
//   The npm script loads packages/backend/.env if present (--env-file-if-exists), so
//   Doug's local ANTHROPIC_API_KEY is picked up automatically. With no key it falls back
//   to the deterministic fake, so the harness still runs end to end (just not the model).
//
// EXTENDING TO THE NEXT LENS: when a sibling lens gets its own real system contract +
// tolerant parse, add ONE entry to LENS_RUNNERS. An Evidence-wave lens reads the units
// with an empty prior-findings snapshot (like Listening below); a later-wave lens builds
// representative prior findings first (like `meaning`, which runs Listening for real to
// get the voices, then interprets them). Keep this the place prompts are tuned.

// The eval fixture (SAMPLE_UNITS) lives in ./sample-units.ts — the single source of truth,
// shared with the real-model falsifier harnesses. See that file for the per-unit rationale
// (Listening contract probes, the eight Human Meaning outputs + restraint controls, u9).

interface LensRun {
  readonly findings: readonly Finding[];
  /** Per-voice lenses: the (run_id, voice_id) ledger accounting they produced. */
  readonly ledger?: RunLedger;
  readonly runIds?: readonly string[];
  /** Cross-voice lenses: the cited-or-residual audit + any uncited-pattern defect. */
  readonly crossVoice?: {
    readonly lensId: string;
    readonly audit: CitationAudit;
    readonly uncitedDefects: readonly string[];
  };
}
type LensRunner = (units: readonly Unit[], provider: LlmProvider) => Promise<LensRun>;

// The lenses now run through the PRODUCTION orchestrator (per-voice fan-out + four-state
// ledger); the eval harness passes a durable ledger so every run additionally produces
// (run_id, voice_id) terminal records, printed below. Only lenses with a REAL system
// contract + tolerant parse belong here.
const LENS_RUNNERS: Record<string, LensRunner> = {
  listening: async (units, provider) => {
    const ledger = new SqliteRunLedger(':memory:');
    const { findings } = await runPerVoiceLens(new ListeningLens(), units, [], provider, {
      ledger,
      runId: 'eval:listening',
    });
    return { findings, ledger, runIds: ['eval:listening'] };
  },
  // Meaning is INTERPRETIVE and reads the Listening findings, so build them first (for
  // real) and then interpret each voice. The bilingual SAMPLE_UNITS carry Spanish (u5,
  // u8) and mixed (u13) voices, so the translation path is exercised end to end here: the
  // Spanish lives in the underlying Listening finding's verbatim/translation, and Human
  // Meaning's noticing comes back in English (Item 9, EN/ES). One shared ledger holds both
  // per-voice runs (listening + meaning), each run-scoped.
  meaning: async (units, provider) => {
    const ledger = new SqliteRunLedger(':memory:');
    const listening = await runPerVoiceLens(new ListeningLens(), units, [], provider, {
      ledger,
      runId: 'eval:listening',
    });
    const { findings } = await runPerVoiceLens(new HumanMeaningLens(), units, listening.findings, provider, {
      ledger,
      runId: 'eval:meaning',
    });
    return { findings, ledger, runIds: ['eval:listening', 'eval:meaning'] };
  },
  // Culture Pattern is the first REAL cross-voice lens (Aggregate wave). Per the wave model it
  // reads the whole accumulated PRIOR-WAVE pool — Evidence (Listening) AND Meaning (Human
  // Meaning) — so the delivered set the audit measures matches what the lens actually sees
  // (Human Meaning's noticings included, e.g. the u3/u15 recurrence). Build both prior waves for
  // real, deliver their union, then synthesize + audit.
  culture: async (units, provider) => {
    const ledger = new SqliteRunLedger(':memory:');
    const listening = await runPerVoiceLens(new ListeningLens(), units, [], provider, {
      ledger,
      runId: 'eval:listening',
    });
    const meaning = await runPerVoiceLens(new HumanMeaningLens(), units, listening.findings, provider, {
      ledger,
      runId: 'eval:meaning',
    });
    ledger.close();
    const priorWavePool = [...listening.findings, ...meaning.findings];
    const { findings, audit, uncitedDefects } = await runCrossVoiceLens(
      new CulturePatternLens(),
      units,
      priorWavePool,
      provider,
    );
    return { findings, crossVoice: { lensId: 'culture', audit, uncitedDefects } };
  },
};

async function main(): Promise<void> {
  const lensName = process.argv[2] ?? 'listening';
  const runner = LENS_RUNNERS[lensName];
  if (!runner) {
    console.error(`Unknown lens "${lensName}". Available: ${Object.keys(LENS_RUNNERS).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const usingReal = hasAnthropicKey();
  console.log(`Lens:     ${lensName}`);
  console.log(`Provider: ${usingReal ? `real Anthropic model (${ANTHROPIC_MODEL})` : 'deterministic fake (no ANTHROPIC_API_KEY found)'}`);
  console.log(`Units:    ${SAMPLE_UNITS.length}`);
  for (const unit of SAMPLE_UNITS) {
    console.log(`  [${unit.unitId}] (${unit.speakerToken}, ${unit.language}) ${unit.content}`);
  }
  console.log('');

  const { findings, ledger, runIds, crossVoice } = await runner(SAMPLE_UNITS, selectLlmProvider());

  console.log(`${findings.length} finding(s):\n`);
  for (const finding of findings) {
    console.log(`[${finding.findingId}] (${finding.lens})`);
    // Model B: a surfacing finding carries verbatim, an interpretive one a noticing.
    if (finding.noticing !== null) {
      console.log(`  noticing:   ${finding.noticing}`);
    } else {
      console.log(`  verbatim:   ${finding.verbatim ?? '(none — absence finding)'}`);
    }
    if (finding.translation !== undefined) {
      console.log(`  translation:${finding.translation} (translated from ${finding.sourceLanguage})`);
    }
    console.log(`  anchors:    ${finding.evidenceLinks.join(', ') || '(none)'}`);
    console.log(`  support:    ${finding.supportSet.unitCount} units / ${finding.supportSet.sourceCount} sources`);
    console.log(`  clientSafe: ${finding.clearedToClientSafe} (held by default)\n`);
  }

  // PER-VOICE lenses: the completeness accounting — every voice in one of the four terminal
  // states, plus any per-lens invariant violation (recorded beside a truthful answered-empty).
  if (ledger !== undefined && runIds !== undefined) {
    for (const runId of runIds) {
      const rows = await ledger.allRows(runId);
      const violations = await ledger.invariantViolations(runId);
      console.log(`Ledger [${runId}] — ${rows.length} voice(s):`);
      for (const row of rows) {
        const flag = row.invariantViolation !== undefined ? `  ⚠ INVARIANT: ${row.invariantViolation}` : '';
        console.log(`  ${row.voiceId.padEnd(16)} ${row.state} / ${row.reasonCode}${flag}`);
      }
      console.log(`  invariant violations: ${violations.length}\n`);
    }
    ledger.close();
  }

  // CROSS-VOICE lenses: the cited-or-residual audit + the uncited-pattern defect (surfaced,
  // never retried). A non-empty residual is expected — it is uncited findings made visible.
  if (crossVoice !== undefined) {
    console.log(formatCitationAudit(crossVoice.lensId, crossVoice.audit));
    console.log(
      `  uncited-pattern defects (cited zero existing findings): ${crossVoice.uncitedDefects.length}` +
        (crossVoice.uncitedDefects.length > 0 ? ` — ${crossVoice.uncitedDefects.join(' | ')}` : ''),
    );
    console.log('');
  }
}

await main();
