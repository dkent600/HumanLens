import type { Unit } from '../domain/types.js';
import type { Finding } from '../domain/finding.js';
import type { LlmProvider, LlmRequest, LlmResponse, LlmStopReason, LlmUsage } from '../seams/llm-provider.js';
import { ANTHROPIC_MODEL, EFFORT, MAX_TOKENS } from '../seams/anthropic-llm-provider.js';
import { providerChoice, selectLlmProvider } from '../seams/select-llm-provider.js';
import { ListeningLens, SYSTEM as LISTENING_SYSTEM } from '../engine/lenses/listening-lens.js';
import { HumanMeaningLens, SYSTEM as MEANING_SYSTEM } from '../engine/lenses/human-meaning-lens.js';
import { CulturePatternLens } from '../engine/lenses/culture-pattern-lens.js';
import { runPerVoiceLens } from '../engine/completeness/per-voice-lens.js';
import { runCrossVoiceLens, type CrossVoiceOutcome } from '../engine/completeness/cross-voice-lens.js';
import { formatCitationAudit, type CitationAudit } from '../engine/completeness/cross-voice-audit.js';
import { SqliteRunLedger } from '../seams/sqlite-run-ledger.js';
import type { RunLedger } from '../seams/run-ledger.js';
import { SAMPLE_UNITS } from './sample-units.js';
import {
  POOL_VERSION,
  PoolError,
  checkPoolStaleness,
  describePoolGaps,
  fingerprint,
  fixtureFingerprint,
  loadPool,
  poolExists,
  poolPath,
  providerKind,
  savePool,
  summarizeStates,
  type FrozenPool,
  type PoolStateCounts,
} from './pool.js';
import type { ProviderChoice } from '../seams/select-llm-provider.js';

// Dev / eval harness — the manual path for eyeballing REAL model output on ONE lens,
// the loop where a lens's prompt gets tuned. It is NOT part of the server: buildContainer
// and the running app stay on the fake; only this entry point selects the real provider.
//
//   Build + run (from packages/backend):  npm run eval -- listening
//   The npm script loads packages/backend/.env if present (--env-file-if-exists), so
//   Doug's local ANTHROPIC_API_KEY is picked up automatically. With no key it falls back
//   to the deterministic fake, so the harness still runs end to end (just not the model).
//
//   npm run eval -- __check__ --fake        verify --fake at ZERO cost (see main)
//   npm run eval -- culture --capture-pool=baseline-a
//   npm run eval -- culture --pool=baseline-a --repeat=5
//
// FROZEN POOLS (see pool.ts for the full rationale). A LIVE `culture` run rebuilds its prior
// wave every time, so Culture Pattern's input — and therefore the audit's `delivered`
// denominator — varies run to run. Capture freezes that pool once; replay makes Culture
// Pattern's own call the only variable, at 1 model call per sample instead of ~80.
//
// EXTENDING TO THE NEXT LENS: when a sibling lens gets its own real system contract +
// tolerant parse, add ONE entry to LENS_RUNNERS. An Evidence-wave lens reads the units
// with an empty prior-findings snapshot (like Listening below); a later-wave lens builds
// representative prior findings first (like `meaning`, which runs Listening for real to
// get the voices, then interprets them). Keep this the place prompts are tuned.

// The eval fixture (SAMPLE_UNITS) lives in ./sample-units.ts — the single source of truth,
// shared with the real-model falsifier harnesses. See that file for the per-unit rationale
// (Listening contract probes, the eight Human Meaning outputs + restraint controls, u9).

interface CrossVoiceReport {
  readonly lensId: string;
  readonly audit: CitationAudit;
  readonly uncitedDefects: readonly string[];
  /** How the single call finished — separates a truncation from an honest empty. */
  readonly outcome?: CrossVoiceOutcome;
}

interface LensRun {
  readonly findings: readonly Finding[];
  /** Per-voice lenses: the (run_id, voice_id) ledger accounting they produced. */
  readonly ledger?: RunLedger;
  readonly runIds?: readonly string[];
  readonly crossVoice?: CrossVoiceReport;
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

// ── The prior wave, built live ──────────────────────────────────────────────────

interface PriorWave {
  readonly pool: readonly Finding[];
  readonly counts: { readonly listening: number; readonly meaning: number; readonly total: number };
  readonly terminalStates: { readonly listening: PoolStateCounts; readonly meaning: PoolStateCounts };
}

/**
 * Run Listening + Human Meaning for real and return their union — the prior-wave pool Culture
 * Pattern reads. ~35 calls for Listening (one per unit) plus one call per Listening FINDING
 * for Human Meaning (variable: a unit may split into several findings), so ~80 in total.
 */
async function buildPriorWave(units: readonly Unit[], provider: LlmProvider): Promise<PriorWave> {
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
  return {
    pool: [...listening.findings, ...meaning.findings],
    counts: {
      listening: listening.findings.length,
      meaning: meaning.findings.length,
      total: listening.findings.length + meaning.findings.length,
    },
    terminalStates: {
      listening: summarizeStates(listening.observations),
      meaning: summarizeStates(meaning.observations),
    },
  };
}

/** One Culture Pattern synthesis over a given pool — EXACTLY one model call. */
async function runCultureOnPool(
  units: readonly Unit[],
  pool: readonly Finding[],
  provider: LlmProvider,
): Promise<LensRun> {
  const { findings, audit, uncitedDefects, outcome } = await runCrossVoiceLens(
    new CulturePatternLens(),
    units,
    pool,
    provider,
  );
  return {
    findings,
    crossVoice: { lensId: 'culture', audit, uncitedDefects, ...(outcome !== undefined ? { outcome } : {}) },
  };
}

// The lenses run through the PRODUCTION orchestrator (per-voice fan-out + four-state ledger);
// the eval harness passes a durable ledger so every run additionally produces (run_id,
// voice_id) terminal records, printed below. Only lenses with a REAL system contract +
// tolerant parse belong here.
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
  //
  // NOTE: this runner has the SAME live-pool confound as a live `culture` run, one stage up —
  // its input is freshly generated Listening output, so a Human Meaning baseline taken here
  // measures two stages. Freezing applies equally if that is ever baselined.
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
  // Meaning). LIVE mode rebuilds that pool every run; --pool replays a frozen one instead.
  culture: async (units, provider) => {
    const { pool } = await buildPriorWave(units, provider);
    return runCultureOnPool(units, pool, provider);
  },
};

// ── Entry point ─────────────────────────────────────────────────────────────────

function flagValue(argv: readonly string[], name: string): string | undefined {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

async function main(): Promise<void> {
  // `--fake` forces the deterministic fake even when a key is present. It exists because
  // the npm script loads .env on every invocation, so key-absence is not a repeatable way
  // to ask for a free run. Flags are filtered out before reading the lens name, so
  // `npm run eval -- culture --fake` and `-- --fake culture` both work.
  const argv = process.argv.slice(2);
  const forceFake = argv.includes('--fake');
  const overwrite = argv.includes('--overwrite');
  const allowStale = argv.includes('--allow-stale-pool');
  const capturePool = flagValue(argv, 'capture-pool');
  const replayPool = flagValue(argv, 'pool');
  const repeat = Number(flagValue(argv, 'repeat') ?? '1');
  const lensName = argv.find((arg) => !arg.startsWith('--')) ?? 'listening';

  // DELIBERATE-TRUNCATION KNOBS. The truncation path guards the failure that would silently
  // cost a baseline, so its first execution should not be the run it was built to save.
  //   --fake-stop-reason=max_tokens  free rehearsal: no model call, exercises the routing and
  //                                  the print branch on the fake.
  //   --max-tokens=N                 the real thing: a tiny ceiling forces stop_reason
  //                                  max_tokens on one real call.
  const maxTokensOverride = flagValue(argv, 'max-tokens');
  const effectiveMaxTokens = maxTokensOverride !== undefined ? Number(maxTokensOverride) : MAX_TOKENS;
  const fakeStopReason = flagValue(argv, 'fake-stop-reason') as LlmStopReason | undefined;

  // The declared provenance of the run. It names not just WHICH provider but WHY, because
  // "fake because forced" and "fake because no key found" are very different facts about a
  // baseline — and a forced run must not look like an accident of a missing key.
  //
  // PRINTED BEFORE THE LENS IS RESOLVED, DELIBERATELY. This makes `--fake` verifiable at
  // ZERO COST: an unknown lens name prints this line and then exits, having constructed no
  // provider and made no call. That matters because the cheapest-looking way to test the
  // flag is the most expensive way to get it wrong — a live `culture` run drives Listening
  // and Human Meaning before it synthesizes, so a flag that failed to parse would bill ~80
  // calls, not one. Verify with a nonsense lens name first:
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
  if (capturePool !== undefined && replayPool !== undefined) {
    console.error('--capture-pool and --pool are mutually exclusive: capture writes a pool, replay reads one.');
    process.exitCode = 1;
    return;
  }
  if ((capturePool !== undefined || replayPool !== undefined) && lensName !== 'culture') {
    console.error(`Pool capture/replay applies to the cross-voice lens only; "${lensName}" reads no prior-wave pool.`);
    process.exitCode = 1;
    return;
  }
  if (!Number.isInteger(repeat) || repeat < 1) {
    console.error(`--repeat must be a positive integer (got "${flagValue(argv, 'repeat')}").`);
    process.exitCode = 1;
    return;
  }
  if (repeat > 1 && replayPool === undefined) {
    // Repeating a LIVE run would rebuild the pool each time — N samples of N different
    // inputs, which is the confound this whole mechanism exists to remove.
    console.error('--repeat requires --pool: repeating a live run varies the input, which is not a variance measurement.');
    process.exitCode = 1;
    return;
  }
  if (!Number.isInteger(effectiveMaxTokens) || effectiveMaxTokens < 1) {
    console.error(`--max-tokens must be a positive integer (got "${maxTokensOverride}").`);
    process.exitCode = 1;
    return;
  }
  // Record the sampling parameters IN the run output — a baseline that does not say what it
  // ran on cannot be compared with anything later. Printed for the FAKE too: a fake run that
  // silently omits them is the same "true but silent about its provenance" failure as the
  // rest of this harness keeps producing.
  const overridden = maxTokensOverride !== undefined ? '  ⚠ OVERRIDDEN via --max-tokens' : '';
  if (usingReal) {
    console.log(
      `Params:   max_tokens ${effectiveMaxTokens}${overridden} | thinking adaptive | effort ${EFFORT} | ` +
        `temperature: model default (non-default values are rejected on this model)`,
    );
  } else {
    console.log(
      `Params:   max_tokens ${effectiveMaxTokens}${overridden} | (fake provider — no sampling occurs; ` +
        `these are the values a real run would send)` +
        (fakeStopReason !== undefined ? `\n          ⚠ fake finish signal FORCED to "${fakeStopReason}"` : ''),
    );
  }

  const recorder = new UsageRecordingProvider(
    selectLlmProvider({
      forceFake,
      ...(maxTokensOverride !== undefined ? { maxTokens: effectiveMaxTokens } : {}),
      ...(fakeStopReason !== undefined ? { fakeStopReason } : {}),
    }),
  );

  if (capturePool !== undefined) {
    await doCapture(capturePool, recorder, choice, overwrite, effectiveMaxTokens);
    return;
  }
  if (replayPool !== undefined) {
    await doReplay(replayPool, recorder, choice, { repeat, allowStale, maxTokens: effectiveMaxTokens });
    return;
  }

  // ── LIVE mode (unchanged) ──
  console.log(`Units:    ${SAMPLE_UNITS.length}`);
  for (const unit of SAMPLE_UNITS) {
    console.log(`  [${unit.unitId}] (${unit.speakerToken}, ${unit.language}) ${unit.content}`);
  }
  console.log('');
  if (lensName === 'culture') {
    console.log('⚠ LIVE POOL — Listening and Human Meaning are being rebuilt for this run, so Culture');
    console.log("  Pattern's input (and the audit's `delivered` denominator) differs from any other run.");
    console.log('  For a comparable measurement capture a pool once and replay it:');
    console.log('      npm run eval -- culture --capture-pool=<name>');
    console.log('      npm run eval -- culture --pool=<name> --repeat=N\n');
  }

  const { findings, ledger, runIds, crossVoice } = await runner(SAMPLE_UNITS, recorder);
  printFindings(findings);
  if (ledger !== undefined && runIds !== undefined) {
    await printLedger(ledger, runIds);
  }
  if (crossVoice !== undefined) {
    printCrossVoice(crossVoice, effectiveMaxTokens);
  }
  reportUsage(recorder.calls, effectiveMaxTokens);
}

// ── Capture ─────────────────────────────────────────────────────────────────────

async function doCapture(
  name: string,
  recorder: UsageRecordingProvider,
  choice: ProviderChoice,
  overwrite: boolean,
  maxTokens: number,
): Promise<void> {
  console.log(`Mode:     CAPTURE pool "${name}"`);

  // THE NAME CHECK COMES FIRST — before ~80 model calls, not after them. savePool refuses an
  // overwrite too, but it can only do so once the pool has been built and paid for. A
  // mistyped name is the most expensive foreseeable mistake in this workflow, and it must
  // cost nothing.
  if (!overwrite && (await poolExists(name))) {
    console.error(
      `pool "${name}" already exists at ${poolPath(name)}\n` +
        `  Refusing BEFORE running anything: overwriting would retroactively unmoor every\n` +
        `  measurement already taken against this name.\n` +
        `  Pass --overwrite to replace it deliberately, or choose another name.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log('          Running Listening + Human Meaning live. Culture Pattern is NOT run —');
  console.log('          a Culture sample taken during capture would be a LIVE-pool sample, the');
  console.log('          exact thing a frozen pool exists to avoid.\n');

  const wave = await buildPriorWave(SAMPLE_UNITS, recorder);
  const pool: FrozenPool = {
    poolVersion: POOL_VERSION,
    name,
    capturedAt: new Date().toISOString(),
    provenance: {
      providerChoice: choice,
      model: ANTHROPIC_MODEL,
      // The EFFECTIVE ceiling, not the constant — a pool captured under an override must
      // record what actually produced it, or its staleness check compares a fiction.
      maxTokens,
      effort: EFFORT,
      fixtureFingerprint: fixtureFingerprint(SAMPLE_UNITS),
      upstreamPrompts: {
        listening: fingerprint(LISTENING_SYSTEM),
        meaning: fingerprint(MEANING_SYSTEM),
      },
      counts: wave.counts,
      terminalStates: wave.terminalStates,
    },
    findings: wave.pool,
  };

  try {
    const written = await savePool(pool, { overwrite });
    console.log(`Captured ${wave.counts.total} finding(s) — ${wave.counts.listening} listening + ${wave.counts.meaning} meaning`);
    console.log(`Written to ${written}\n`);
  } catch (err) {
    console.error(err instanceof PoolError ? err.message : String(err));
    process.exitCode = 1;
    return;
  }
  printProvenance(pool);
  printStateCounts(pool);
  const gaps = describePoolGaps(pool);
  if (gaps.length > 0) {
    console.log('POOL HAS GAPS — voices that produced no finding are simply absent from it:');
    for (const line of gaps) console.log(line);
    console.log('');
  }
  reportUsage(recorder.calls, maxTokens);
  console.log(`Replay with:  npm run eval -- culture --pool=${name}`);
}

// ── Replay ──────────────────────────────────────────────────────────────────────

async function doReplay(
  name: string,
  recorder: UsageRecordingProvider,
  choice: ProviderChoice,
  options: { readonly repeat: number; readonly allowStale: boolean; readonly maxTokens: number },
): Promise<void> {
  let pool: FrozenPool;
  try {
    pool = await loadPool(name);
  } catch (err) {
    console.error(err instanceof PoolError ? err.message : String(err));
    process.exitCode = 1;
    return;
  }

  console.log(`Mode:     REPLAY frozen pool "${name}" (${poolPath(name)})`);
  console.log(`          ${pool.provenance.counts.total} findings — the audit's \`delivered\` set, now FIXED\n`);
  printProvenance(pool);

  const issues = checkPoolStaleness(pool, {
    providerChoice: choice,
    model: ANTHROPIC_MODEL,
    maxTokens: options.maxTokens,
    effort: EFFORT,
    fixtureFingerprint: fixtureFingerprint(SAMPLE_UNITS),
    upstreamPrompts: { listening: fingerprint(LISTENING_SYSTEM), meaning: fingerprint(MEANING_SYSTEM) },
  });
  const refusals = issues.filter((i) => i.severity === 'refuse');
  for (const issue of issues.filter((i) => i.severity === 'warn')) {
    console.log(`⚠ WARNING — ${issue.field}: captured ${issue.captured}, now ${issue.current}`);
    console.log(`  ${issue.why}\n`);
  }
  if (refusals.length > 0) {
    const header = options.allowStale ? '⚠⚠ STALE POOL — PROCEEDING ANYWAY (--allow-stale-pool)' : 'REFUSING — this pool is stale:';
    console.error(header);
    for (const issue of refusals) {
      console.error(`  ${issue.field}: captured ${issue.captured}, now ${issue.current}`);
      console.error(`    ${issue.why}`);
    }
    if (!options.allowStale) {
      console.error('\n  Capture a fresh pool, or pass --allow-stale-pool to compare unlike with unlike deliberately.');
      process.exitCode = 1;
      return;
    }
    console.error('  Any comparison from this run is against upstream that has since changed.\n');
  }

  printStateCounts(pool);
  const gaps = describePoolGaps(pool);
  if (gaps.length > 0) {
    console.log('⚠ THIS POOL HAS GAPS — voices that produced no finding at capture are ABSENT from it,');
    console.log('  so every measurement below inherits those gaps. It is not a clean pool:');
    for (const line of gaps) console.log(line);
    console.log('');
  }

  // Each replay is EXACTLY one model call. Full output every run — the primary criterion is
  // CATEGORICAL (is the pattern set stable? do specific voices stay in the residual?), which
  // a coverage-only summary would hide.
  const runs: CrossVoiceReport[] = [];
  for (let i = 1; i <= options.repeat; i += 1) {
    if (options.repeat > 1) {
      console.log(`${'='.repeat(72)}\nRUN ${i} of ${options.repeat}\n${'='.repeat(72)}\n`);
    }
    const { findings, crossVoice } = await runCultureOnPool(SAMPLE_UNITS, pool.findings, recorder);
    printFindings(findings);
    if (crossVoice !== undefined) {
      printCrossVoice(crossVoice, options.maxTokens);
      runs.push(crossVoice);
    }
  }
  if (options.repeat > 1) {
    printSpread(runs, choice);
  }
  reportUsage(recorder.calls, options.maxTokens);
}

/**
 * The across-run view. Printed IN ADDITION to every run's full output, never instead of it:
 * the spread answers "how much does coverage move", but the decision-relevant question is
 * categorical — whether the same patterns and the same residual voices recur — and that is
 * only visible in the runs themselves.
 */
function printSpread(runs: readonly CrossVoiceReport[], choice: ProviderChoice): void {
  if (runs.length === 0) return;
  console.log(`${'='.repeat(72)}\nACROSS ${runs.length} RUNS — same frozen pool, Culture Pattern's call the only variable\n${'='.repeat(72)}`);
  if (providerKind(choice) === 'fake') {
    // Say it HERE, not only in the header 80 lines up. A zero spread from the deterministic
    // fake is guaranteed by construction, and a reader skimming this block would otherwise
    // take it for a finding about the lens's stability.
    console.log('⚠ FAKE PROVIDER — the fake is deterministic, so every run is byte-identical and the');
    console.log('  spread below is ZERO BY CONSTRUCTION. It says nothing about the lens. This block');
    console.log('  only measures anything on a real-model run.');
  }

  const coverages = runs.map((r) => r.audit.coverageRatio);
  const patternCounts = runs.map((r) => r.audit.cited.length);
  console.log('per run:');
  runs.forEach((r, i) => {
    console.log(
      `  run ${String(i + 1).padStart(2)}: ${(r.audit.coverageRatio * 100).toFixed(1)}% coverage | ` +
        `${r.audit.cited.length} cited | ${r.audit.residual.length} residual | ` +
        `${r.uncitedDefects.length} defect(s) | ${r.outcome?.state ?? 'no outcome'}`,
    );
  });
  const min = Math.min(...coverages);
  const max = Math.max(...coverages);
  const mean = coverages.reduce((a, b) => a + b, 0) / coverages.length;
  console.log(
    `coverage: min ${(min * 100).toFixed(1)}% | mean ${(mean * 100).toFixed(1)}% | max ${(max * 100).toFixed(1)}% ` +
      `| spread ${((max - min) * 100).toFixed(1)} points`,
  );
  console.log(`cited count: min ${Math.min(...patternCounts)} | max ${Math.max(...patternCounts)}`);

  // CATEGORICAL STABILITY — the part that actually answers "does this voice keep landing in
  // the residual?". A finding residual in EVERY run is a stable outlier; one residual in only
  // some runs is a coin-flip, and that difference matters more than the ratio.
  const residualSets = runs.map((r) => new Set(r.audit.residual));
  const everResidual = [...new Set(runs.flatMap((r) => [...r.audit.residual]))].sort();
  if (everResidual.length === 0) {
    // Two "(none)" lines would be noise dressed as a result — there is nothing to classify.
    console.log('residual: NO run left any finding uncited (nothing to classify as stable or unstable)');
  } else {
    const always = everResidual.filter((id) => residualSets.every((s) => s.has(id)));
    const sometimes = everResidual.filter((id) => !residualSets.every((s) => s.has(id)));
    console.log(`residual in EVERY run (stable outliers): ${always.length > 0 ? always.join(', ') : '(none)'}`);
    console.log(`residual in SOME runs only (unstable):   ${sometimes.length > 0 ? sometimes.join(', ') : '(none)'}`);
  }
  console.log('');
}

// ── Printing helpers ────────────────────────────────────────────────────────────

function printFindings(findings: readonly Finding[]): void {
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
}

// PER-VOICE lenses: the completeness accounting — every voice in one of the four terminal
// states, plus any per-lens invariant violation (recorded beside a truthful answered-empty).
async function printLedger(ledger: RunLedger, runIds: readonly string[]): Promise<void> {
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
function printCrossVoice(crossVoice: CrossVoiceReport, maxTokens: number): void {
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
      console.log(`  ⚠ TRUNCATED — the ${maxTokens}-token ceiling was exhausted. The empty/short pattern set`);
      console.log('    above is an ARTIFACT OF THE CEILING, not a finding about the lens. Raise');
      console.log('    the ceiling and re-run before reading anything into the audit numbers.');
    } else if (outcome.state === 'answered-empty') {
      console.log('  (natural finish, no patterns — a genuine empty result about this corpus, not a truncation)');
    }
    console.log(`  ${formatUsage(outcome.usage, maxTokens)}`);
  }
  console.log(formatCitationAudit(crossVoice.lensId, crossVoice.audit));
  console.log(
    `  uncited-pattern defects (cited zero existing findings): ${crossVoice.uncitedDefects.length}` +
      (crossVoice.uncitedDefects.length > 0 ? ` — ${crossVoice.uncitedDefects.join(' | ')}` : ''),
  );
  console.log('');
}

/** The capture run's four-state distribution, carried on the pool and shown on every replay. */
function printStateCounts(pool: FrozenPool): void {
  console.log('Capture-time terminal states (a voice not answered-with-findings contributes NOTHING to the pool):');
  for (const [wave, c] of Object.entries(pool.provenance.terminalStates)) {
    console.log(
      `  ${wave.padEnd(10)} answered-with-findings ${c.answeredWithFindings} | answered-empty ${c.answeredEmpty} | ` +
        `delivered-but-unusable ${c.deliveredButUnusable} | failed ${c.failed} | invariant violations ${c.invariantViolations}`,
    );
  }
  console.log('');
}

/** One call's token usage against the EFFECTIVE ceiling, thinking split out. */
function formatUsage(usage: LlmUsage | undefined, maxTokens: number): string {
  if (usage === undefined) return 'usage: not reported (fake provider)';
  const pct = ((usage.outputTokens / maxTokens) * 100).toFixed(1);
  const thinking =
    usage.thinkingTokens !== undefined
      ? `${usage.thinkingTokens} thinking + ${usage.outputTokens - usage.thinkingTokens} answer`
      : 'thinking breakdown not reported';
  return `usage: ${usage.inputTokens} in / ${usage.outputTokens} out (${thinking}) — ${pct}% of the ${maxTokens} ceiling`;
}

/**
 * The pool's FULL provenance, printed at capture and on every replay — enough to reconstruct
 * what produced it without opening the JSON.
 *
 * It names the PROVIDER, not just the source constants. A pool captured on the fake had no
 * model call at all; printing "on claude-opus-5 at effort high" without that qualifier
 * describes a run that never happened. The provider-kind refusal stops a fake pool being
 * replayed as real, but a guard that holds is not a reason for a line that misleads.
 */
function printProvenance(pool: FrozenPool): void {
  const p = pool.provenance;
  const fake = providerKind(p.providerChoice) === 'fake';
  console.log('Pool provenance:');
  console.log(`  captured:   ${pool.capturedAt}  (poolVersion ${pool.poolVersion})`);
  console.log(`  provider:   ${p.providerChoice}${fake ? '  ⚠ NO MODEL WAS CALLED — the values below are the constants a real capture would have used' : ''}`);
  console.log(`  model:      ${p.model}${fake ? '  (not actually called)' : ''}`);
  console.log(`  effort:     ${p.effort} | max_tokens ${p.maxTokens}`);
  console.log(`  fixture:    ${p.fixtureFingerprint}`);
  console.log(`  upstream:   listening ${p.upstreamPrompts.listening} | meaning ${p.upstreamPrompts.meaning}`);
  console.log(`  counts:     ${p.counts.listening} listening + ${p.counts.meaning} meaning = ${p.counts.total}`);
  console.log('  (Culture Pattern\'s prompt is deliberately NOT recorded — comparing prompts on one pool is the point)');
  console.log('');
}

/**
 * The run's headroom summary. The number that matters is the CLOSEST any single call came to
 * the ceiling: an average hides the one call that truncated, and it is the individual call
 * that gets silently lost.
 */
function reportUsage(calls: readonly { usage?: LlmUsage; stopReason?: string }[], maxTokens: number): void {
  const withUsage = calls.map((c) => c.usage).filter((u): u is LlmUsage => u !== undefined);
  if (withUsage.length === 0) {
    console.log(`Token usage: not reported (${calls.length} call(s), fake provider)\n`);
    return;
  }
  const peak = withUsage.reduce((a, b) => (b.outputTokens > a.outputTokens ? b : a));
  const totalOut = withUsage.reduce((sum, u) => sum + u.outputTokens, 0);
  const totalThinking = withUsage.reduce((sum, u) => sum + (u.thinkingTokens ?? 0), 0);
  const truncatedCount = calls.filter((c) => c.stopReason === 'max_tokens').length;

  console.log(`Token usage — ${calls.length} call(s), ceiling ${maxTokens} per call:`);
  console.log(`  total output:   ${totalOut} (${totalThinking} of it thinking)`);
  console.log(`  closest call:   ${formatUsage(peak, maxTokens)}`);
  console.log(
    `  truncated calls (stopReason max_tokens): ${truncatedCount}` +
      (truncatedCount > 0 ? '  ⚠ RAISE THE CEILING AND RE-RUN' : ''),
  );
  console.log('');
}

await main();
