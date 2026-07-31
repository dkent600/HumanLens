import type { Unit } from '../domain/types.js';
import type { Finding } from '../domain/finding.js';
import type { LlmProvider, LlmRequest, LlmResponse, LlmUsage } from '../seams/llm-provider.js';
import { ANTHROPIC_MODEL, EFFORT, MAX_TOKENS } from '../seams/anthropic-llm-provider.js';
import { providerChoice, selectLlmProvider } from '../seams/select-llm-provider.js';
import { ListeningLens } from '../engine/lenses/listening-lens.js';
import { HumanMeaningLens } from '../engine/lenses/human-meaning-lens.js';
import { CulturePatternLens } from '../engine/lenses/culture-pattern-lens.js';
import { runPerVoiceLens } from '../engine/completeness/per-voice-lens.js';
import { runCrossVoiceLens, type CrossVoiceOutcome } from '../engine/completeness/cross-voice-lens.js';
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
    /** How the single call finished — separates a truncation from an honest empty. */
    readonly outcome?: CrossVoiceOutcome;
  };
}
type LensRunner = (units: readonly Unit[], provider: LlmProvider) => Promise<LensRun>;

/**
 * A provider DECORATOR that records every call's usage — eval-side only, so the engine and
 * the seam stay untouched (instrumentation belongs in the harness, not in the pipeline).
 *
 * It exists because thinking is now the largest and least visible part of a call: on an
 * adaptive-thinking model the reasoning is billed as output AND counts against `max_tokens`,
 * so a call can run out of ceiling while thinking and be truncated before writing an answer.
 * The per-voice ledger records terminal STATES but carries no usage, so without this wrapper
 * there is no way to see how close any individual call ran to the ceiling.
 */
class UsageRecordingProvider implements LlmProvider {
  readonly calls: { usage?: LlmUsage; stopReason?: string }[] = [];
  constructor(private readonly inner: LlmProvider) {}
  async complete(request: LlmRequest): Promise<LlmResponse> {
    const response = await this.inner.complete(request);
    this.calls.push({
      ...(response.usage !== undefined ? { usage: response.usage } : {}),
      ...(response.stopReason !== undefined ? { stopReason: response.stopReason } : {}),
    });
    return response;
  }
}

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
    const { findings, audit, uncitedDefects, outcome } = await runCrossVoiceLens(
      new CulturePatternLens(),
      units,
      priorWavePool,
      provider,
    );
    return {
      findings,
      crossVoice: {
        lensId: 'culture',
        audit,
        uncitedDefects,
        ...(outcome !== undefined ? { outcome } : {}),
      },
    };
  },
};

async function main(): Promise<void> {
  // `--fake` forces the deterministic fake even when a key is present. It exists because
  // the npm script loads .env on every invocation, so key-absence is not a repeatable way
  // to ask for a free run. Flags are filtered out before reading the lens name, so
  // `npm run eval -- culture --fake` and `-- --fake culture` both work.
  const argv = process.argv.slice(2);
  const forceFake = argv.includes('--fake');
  const lensName = argv.find((arg) => !arg.startsWith('--')) ?? 'listening';

  // The declared provenance of the run. It names not just WHICH provider but WHY, because
  // "fake because forced" and "fake because no key found" are very different facts about a
  // baseline — and a forced run must not look like an accident of a missing key.
  //
  // PRINTED BEFORE THE LENS IS RESOLVED, DELIBERATELY. This makes `--fake` verifiable at
  // ZERO COST: an unknown lens name prints this line and then exits, having constructed no
  // provider and made no call. That matters because the cheapest-looking way to test the
  // flag is the most expensive way to get it wrong — `culture` runs Listening and Human
  // Meaning live before it synthesizes, so a flag that failed to parse would bill ~71 calls,
  // not one. Verify with a nonsense lens name first:
  //     npm run eval -- __check__ --fake
  const choice = providerChoice({ forceFake });
  const usingReal = choice === 'real';
  const providerLabel =
    choice === 'real'
      ? `real Anthropic model (${ANTHROPIC_MODEL})`
      : choice === 'fake-forced'
        ? 'deterministic fake — FORCED via --fake (any API key deliberately ignored)'
        : 'deterministic fake (no ANTHROPIC_API_KEY found)';
  console.log(`Lens:     ${lensName}`);
  console.log(`Provider: ${providerLabel}`);

  const runner = LENS_RUNNERS[lensName];
  if (!runner) {
    console.error(`Unknown lens "${lensName}". Available: ${Object.keys(LENS_RUNNERS).join(', ')}`);
    process.exitCode = 1;
    return;
  }
  if (usingReal) {
    // Record the sampling parameters IN the run output — a baseline that does not say what
    // it ran on cannot be compared with anything later.
    console.log(`Params:   max_tokens ${MAX_TOKENS} | thinking adaptive | effort ${EFFORT} | temperature: model default (non-default values are rejected on this model)`);
  }
  console.log(`Units:    ${SAMPLE_UNITS.length}`);
  for (const unit of SAMPLE_UNITS) {
    console.log(`  [${unit.unitId}] (${unit.speakerToken}, ${unit.language}) ${unit.content}`);
  }
  console.log('');

  const recorder = new UsageRecordingProvider(selectLlmProvider({ forceFake }));
  const { findings, ledger, runIds, crossVoice } = await runner(SAMPLE_UNITS, recorder);

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
    // The CALL DISPOSITION comes FIRST, before the audit. Zero patterns / 0% coverage /
    // everything residual is what a truncation and an honest empty BOTH look like; the audit
    // numbers are only interpretable once this line says the call actually completed.
    const outcome = crossVoice.outcome;
    if (outcome === undefined) {
      console.log(`cross-voice call [${crossVoice.lensId}] — no model call made (no prior findings)`);
    } else {
      const truncated = outcome.stopReason === 'max_tokens';
      console.log(
        `cross-voice call [${crossVoice.lensId}] — ${outcome.state} / ${outcome.reasonCode}` +
          ` (stopReason: ${outcome.stopReason ?? 'none reported'})`,
      );
      if (truncated) {
        console.log(
          `  ⚠ TRUNCATED — the ${MAX_TOKENS}-token ceiling was exhausted. The empty/short pattern set`,
        );
        console.log('    below is an ARTIFACT OF THE CEILING, not a finding about the lens. Raise');
        console.log('    MAX_TOKENS and re-run before reading anything into the audit numbers.');
      } else if (outcome.state === 'answered-empty') {
        console.log(
          '  (natural finish, no patterns — a genuine empty result about this corpus, not a truncation)',
        );
      }
      console.log(`  ${formatUsage(outcome.usage)}`);
    }
    console.log(formatCitationAudit(crossVoice.lensId, crossVoice.audit));
    console.log(
      `  uncited-pattern defects (cited zero existing findings): ${crossVoice.uncitedDefects.length}` +
        (crossVoice.uncitedDefects.length > 0 ? ` — ${crossVoice.uncitedDefects.join(' | ')}` : ''),
    );
    console.log('');
  }

  // EVERY call's distance from the output ceiling — per-voice calls included (the ledger
  // records states but carries no usage, so this wrapper is the only place they show up).
  reportUsage(recorder.calls);
}

/** One call's token usage against the ceiling, thinking split out. */
function formatUsage(usage: LlmUsage | undefined): string {
  if (usage === undefined) return 'usage: not reported (fake provider)';
  const pct = ((usage.outputTokens / MAX_TOKENS) * 100).toFixed(1);
  const thinking =
    usage.thinkingTokens !== undefined
      ? `${usage.thinkingTokens} thinking + ${usage.outputTokens - usage.thinkingTokens} answer`
      : 'thinking breakdown not reported';
  return `usage: ${usage.inputTokens} in / ${usage.outputTokens} out (${thinking}) — ${pct}% of the ${MAX_TOKENS} ceiling`;
}

/**
 * The run's headroom summary. The number that matters is the CLOSEST any single call came to
 * the ceiling: an average hides the one call that truncated, and it is the individual call
 * that gets silently lost.
 */
function reportUsage(calls: readonly { usage?: LlmUsage; stopReason?: string }[]): void {
  const withUsage = calls.map((c) => c.usage).filter((u): u is LlmUsage => u !== undefined);
  if (withUsage.length === 0) {
    console.log(`Token usage: not reported (${calls.length} call(s), fake provider)\n`);
    return;
  }
  const peak = withUsage.reduce((a, b) => (b.outputTokens > a.outputTokens ? b : a));
  const totalOut = withUsage.reduce((sum, u) => sum + u.outputTokens, 0);
  const totalThinking = withUsage.reduce((sum, u) => sum + (u.thinkingTokens ?? 0), 0);
  const truncatedCount = calls.filter((c) => c.stopReason === 'max_tokens').length;

  console.log(`Token usage — ${calls.length} call(s), ceiling ${MAX_TOKENS} per call:`);
  console.log(`  total output:   ${totalOut} (${totalThinking} of it thinking)`);
  console.log(`  closest call:   ${formatUsage(peak)}`);
  console.log(
    `  truncated calls (stopReason max_tokens): ${truncatedCount}` +
      (truncatedCount > 0 ? '  ⚠ RAISE THE CEILING AND RE-RUN' : ''),
  );
  console.log('');
}

await main();
