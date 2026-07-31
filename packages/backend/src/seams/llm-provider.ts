// The LLM provider seam — the engine the lenses run on, kept behind a thin,
// swappable interface so the vendor (Anthropic, OpenAI, Google, ...) can change
// without touching call sites. The choice of provider is deliberately TBD.
//
// The seam is GENERIC and domain-agnostic: prompt in; text + finish signal out. It
// knows nothing of units or findings — that keeps it reusable by every lens and every
// future module. A lens owns building its prompt and parsing the response; the
// provider ferries text to and from "the model" and reports HOW the model finished
// (`stopReason`), which the completeness accounting depends on (see LlmResponse).

export interface LlmRequest {
  /** Optional system instruction (role/posture for the model). */
  readonly system?: string;
  /** The prompt the model is asked to complete. */
  readonly prompt: string;
}

/**
 * The model's finish signal, in Anthropic-native vocabulary (the raw `stop_reason`).
 * NATURAL completion is `end_turn` (plus `stop_sequence` only where a lens configures
 * one); everything else is NON-natural — the model did not usably finish this answer.
 */
export type LlmStopReason =
  | 'end_turn'
  | 'stop_sequence'
  | 'max_tokens'
  | 'refusal'
  | 'pause_turn'
  | 'tool_use';

/**
 * The seam surfaces the finish signal and (where a provider reports one in-band) the
 * HTTP status alongside the text. The completeness accounting (build_approach.md,
 * "Lens processing"; build_implementation.md, "Lens↔model contract") depends on
 * `stopReason`: a raw empty body cannot certify WHICH empty it is — a refusal can
 * arrive as empty text — so answered-empty is separated from delivered-but-unusable
 * by the finish signal, never the body alone. (The prior seam returned only `{text}`
 * and collapsed a refusal to `{text:''}`; that collapse WAS the fake-empty drop.)
 *
 * `stopReason` is optional so the seam stays provider-agnostic: a provider without a
 * finish signal simply omits it and degrades gracefully (body-only routing — such a
 * provider inherently cannot distinguish chosen-empty from refusal, and the
 * abstraction does not pretend otherwise). Real providers populate it.
 */
/**
 * Per-call token usage, provider-agnostic field names. Optional end to end: a provider
 * that reports none omits it (the fake does). Carried on the seam so cost/cache
 * instrumentation (the F2 falsifier and any future accounting) reads the same seam the
 * lenses do, instead of a parallel eval-only bridge.
 */
export interface LlmUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Prompt-cache reads/writes, where the provider supports caching. */
  readonly cacheReadInputTokens?: number;
  readonly cacheCreationInputTokens?: number;
  /**
   * How many of `outputTokens` the model spent on INTERNAL REASONING (thinking), where the
   * provider reports it. Always <= outputTokens; `outputTokens - thinkingTokens` approximates
   * the visible answer.
   *
   * Load-bearing for the output ceiling, not just for cost: on adaptive-thinking models
   * thinking is billed as output AND counts against `max_tokens`, so a call can exhaust the
   * ceiling while reasoning and be truncated before it writes any answer. That truncation
   * arrives as `stopReason: 'max_tokens'` (routed delivered-but-unusable), which is
   * indistinguishable from a chosen empty by BODY alone — the same class of mistake the
   * fake-empty drop was. This field is how a run shows how close to the ceiling it actually ran.
   */
  readonly thinkingTokens?: number;
}

export interface LlmResponse {
  readonly text: string;
  /** The model's finish signal. Absent only for a provider that carries none. */
  readonly stopReason?: LlmStopReason;
  /** In-band HTTP status, for providers that surface one. (Anthropic's non-2xx outcomes throw instead.) */
  readonly httpStatus?: number;
  /** Per-call token usage, where the provider reports it. */
  readonly usage?: LlmUsage;
}

export interface LlmProvider {
  complete(request: LlmRequest): Promise<LlmResponse>;
}

/**
 * The seam-boundary routing verdict — the minimal four-state read (the G-1 routing
 * half). `proceed` means the finish was natural (or the provider carries no signal):
 * the caller may parse the body, and a usable empty body is a genuine answered-empty.
 * `unusable` means a NON-natural finish: the response must route to
 * delivered-but-unusable and may NEVER be read as answered-empty — that misread is
 * the fake-empty drop (refusal → empty text → recorded as chosen silence → never
 * retried → a permanently, silently dropped voice).
 */
export type LlmResponseRoute =
  | { readonly kind: 'proceed' }
  | { readonly kind: 'unusable'; readonly reason: 'refused' | 'malformed' };

/**
 * Route a response by its finish signal, before any parsing:
 *   - `end_turn` → proceed (natural). `stop_sequence` → proceed only where the caller
 *     declares it uses one (`allowStopSequence`); no current lens does, and the API
 *     only emits it when custom sequences were configured, so an unexpected one is an
 *     anomaly routed unusable rather than trusted.
 *   - `refusal` → unusable, reason `refused`.
 *   - `max_tokens` / `pause_turn` / `tool_use` → unusable, reason `malformed` (a
 *     truncated or out-of-protocol response — delivered, but not an answer).
 *   - absent → proceed (the documented degradation for a signal-less provider).
 * Findings-level behavior stays unchanged for callers (bad output still yields no
 * fabricated finding and never crashes); this verdict is the accounting layer's
 * input — the fan-out orchestrator records `unusable` as delivered-but-unusable.
 */
export function routeLlmResponse(
  response: Pick<LlmResponse, 'stopReason'>,
  options: { readonly allowStopSequence?: boolean } = {},
): LlmResponseRoute {
  const { stopReason } = response;
  if (stopReason === undefined || stopReason === 'end_turn') {
    return { kind: 'proceed' };
  }
  if (stopReason === 'stop_sequence' && options.allowStopSequence === true) {
    return { kind: 'proceed' };
  }
  if (stopReason === 'refusal') {
    return { kind: 'unusable', reason: 'refused' };
  }
  return { kind: 'unusable', reason: 'malformed' };
}

/**
 * The prompt/response convention a lens and the fake share. A real model would
 * receive the same JSON prompt and be instructed to return the same JSON shape;
 * the fake just plays that role deterministically. Kept here (not in the generic
 * seam types) so the seam stays domain-agnostic while the convention is one
 * importable source of truth for both sides.
 */
export interface LensPromptUnit {
  readonly unitId: string;
  readonly speakerToken: string;
  readonly content: string;
}

/**
 * A prior-layer finding as a lens hands it to the model — the projection later
 * lenses (Aggregate and beyond) read instead of the raw units alone. It carries
 * the finding's own unit anchors so a later lens can follow a finding back to the
 * units behind it and anchor its own output to those same units.
 */
export interface LensPromptFinding {
  readonly findingId: string;
  readonly lens: string;
  readonly content: string;
  readonly evidenceUnitIds: readonly string[];
}

/**
 * What the model is being asked to return, so one convention can serve both an
 * emitting lens and the auditing one. `emit` (default): findings about the
 * material. `disposition`: a verdict per prior finding (the Discernment audit).
 * The seam itself stays domain-agnostic — this rides INSIDE the prompt text.
 */
export type LensTask = 'emit' | 'disposition';

/**
 * The Inclusity objective context the Interpret layer calibrates against — the two
 * complementary vocabularies from build_approach.md: the climate-survey domains and
 * the PROSCI/ADKAR change-readiness dimensions.
 *
 * PLACEHOLDER for V1: the shape is fixed but the real values arrive with the V3
 * Inclusity-context work (do not build context injection now). The structured shape
 * — two named vocabularies — is committed so V3 fills values into an existing
 * contract rather than reshaping it; an empty stub means "objectives not wired yet".
 */
export interface ObjectiveFrame {
  /** Inclusity's core climate-survey domains (e.g. belonging, well-being). Empty until V3. */
  readonly surveyDomains: readonly string[];
  /** PROSCI/ADKAR change-readiness dimensions (Awareness…Reinforcement). Empty until V3. */
  readonly adkarDimensions: readonly string[];
}

export interface LensPromptPayload {
  readonly instruction: string;
  /** Defaults to `emit` when absent. */
  readonly task?: LensTask;
  readonly units: readonly LensPromptUnit[];
  /**
   * Findings produced by prior layers. Omitted/empty for Evidence-layer lenses
   * (which read units directly); present for lenses that build on earlier ones.
   */
  readonly priorFindings?: readonly LensPromptFinding[];
  /**
   * The objective context an Interpret-layer lens calibrates against. Present only
   * for that layer (the Inclusity Objective Lens); omitted by all other lenses.
   */
  readonly objectiveFrame?: ObjectiveFrame;
}

export interface LensResponseCandidate {
  /** Surfacing lenses (Listening): the speaker's words exactly as given. Exactly one of verbatim/noticing carries the text. */
  readonly verbatim?: string;
  /** Interpretive lenses (Human Meaning, Tension, Culture Pattern, Objective, Opening): the lens's noticing. */
  readonly noticing?: string;
  /** Literal English translation — present only when `verbatim` is not usable English. Paired with `sourceLanguage`. */
  readonly translation?: string;
  /** Source language name — present only when `translation` is. */
  readonly sourceLanguage?: string;
  /**
   * The findingId of the single PRIOR voice a per-voice interpretive lens (Human Meaning)
   * interprets. That lens derives its anchor by inheriting the named finding's unit rather
   * than trusting a model-emitted unit link, and a source it cannot resolve is dropped
   * (silence). The fake emits it alongside `evidenceUnitIds` so ONE response shape serves
   * both Human Meaning (reads `sourceFindingId`) and the Aggregate+ lenses (read
   * `evidenceUnitIds`); each lens ignores the field it does not use.
   */
  readonly sourceFindingId?: string;
  /**
   * The findingIds a CROSS-VOICE pattern (Culture Pattern, Tension, …) is built on — PLURAL,
   * because a pattern draws on MANY prior findings at once. This is the citation the
   * cited-or-residual audit reads: orchestration code unions these across a lens's emitted
   * findings, subtracts from the delivered set, and surfaces whatever was never cited as a
   * residual (build_implementation.md, "Cross-voice lenses — cited-or-residual audit").
   * Distinct from the singular `sourceFindingId` (Human Meaning's structural single anchor),
   * which is deliberately left untouched. A lens uses one field or the other, never both.
   */
  readonly sourceFindingIds?: readonly string[];
  readonly evidenceUnitIds: readonly string[];
}

export interface LensResponsePayload {
  readonly findings: readonly LensResponseCandidate[];
}

/**
 * The Discernment (Guardrail) convention — a disposition verdict per finding the
 * audit acts on. It does not EMIT findings about the material; it decides which
 * prior findings clear to the client-safe layer and which are sensitive. A finding
 * with no verdict is left untouched (held by default — the safe failure mode).
 */
export interface DispositionVerdict {
  readonly findingId: string;
  /** Affirmatively clear this finding to the client-safe layer. Absent/false = leave held. */
  readonly promote?: boolean;
  /** Flag this finding as sensitive (a hard backstop at Assemble). Absent/false = leave as-is. */
  readonly sensitive?: boolean;
}

export interface DiscernmentResponsePayload {
  readonly verdicts: readonly DispositionVerdict[];
}

/** Either response shape the fake can play, selected by the prompt's `task`. */
export type FakeLensResponse = LensResponsePayload | DiscernmentResponsePayload;

/**
 * A deterministic stand-in for a real model — fixed, predictable output so lens
 * behavior is testable and reproducible without choosing a vendor. It plays the
 * role a prompted model would: it reads the lens's JSON prompt and returns the
 * findings JSON the lens asked for.
 *
 * Default rules, selected by the payload so ONE fake drives every lens reproducibly:
 *   - `task: 'disposition'` (the Discernment audit): promote nothing, flag nothing —
 *     the safe default, so held-by-default stands out of the box.
 *   - With prior findings (an interpretive emit call — Human Meaning, Aggregate+):
 *     emit ONE INTERPRETIVE finding (`noticing`) that cites the units BEHIND those
 *     prior findings — proving the later stage read the prior findings, not just the
 *     units, and that interpretive output stays anchored.
 *   - Otherwise (a surfacing Evidence emit call — Listening): surface ONE finding
 *     (`verbatim`) that cites every unit it was given — so the derived support set
 *     spans all the distinct sources, exercising honest cross-source counting.
 * With nothing to work from it returns no findings. A custom `respond` can script
 * other shapes for tests (e.g. a verdict that promotes or flags a finding).
 */
export class FakeLlmProvider implements LlmProvider {
  /**
   * @param respond scripts the payload -> response mapping (default: the deterministic rules above).
   * @param stopReason the finish signal every completion carries — `end_turn` (natural) by
   *   default so existing behavior is unchanged; a test passes another value to exercise the
   *   four-state routing (e.g. `'refusal'` to prove a refusal never reads as answered-empty).
   */
  constructor(
    private readonly respond: (payload: LensPromptPayload) => FakeLensResponse = defaultFakeResponse,
    private readonly stopReason: LlmStopReason = 'end_turn',
  ) {}

  complete(request: LlmRequest): Promise<LlmResponse> {
    const payload = JSON.parse(request.prompt) as LensPromptPayload;
    const response = this.respond(payload);
    return Promise.resolve({ text: JSON.stringify(response), stopReason: this.stopReason });
  }
}

export function defaultFakeResponse(payload: LensPromptPayload): FakeLensResponse {
  if (payload.task === 'disposition') {
    // Safe default for the audit: promote nothing, flag nothing. Held-by-default
    // stands until something affirmatively decides otherwise — silence, not exposure.
    return { verdicts: [] };
  }
  const priorFindings = payload.priorFindings ?? [];
  if (priorFindings.length > 0) {
    // Any INTERPRETIVE emit lens that reads prior findings (Meaning: Human Meaning;
    // Aggregate: Tension, Culture Pattern; Interpret: Inclusity Objective; Openings:
    // Action Opening): anchor to the units BEHIND the prior findings (deduped), so the
    // output is provably derived from what earlier stages found. Its text is a
    // `noticing` — an interpretation, not a quote (Model B). Neutral content — it
    // stands in for any such lens.
    const unitIds = [...new Set(priorFindings.flatMap((f) => f.evidenceUnitIds))];
    if (unitIds.length === 0) {
      return { findings: [] };
    }
    // One response shape drives every interpretive lens: `sourceFindingId` (singular) names
    // the first prior finding, so the per-voice lens (Human Meaning) inherits that one
    // voice's unit; `sourceFindingIds` (plural) names ALL of them, so a cross-voice lens
    // (Culture Pattern) cites the whole set it drew on; `evidenceUnitIds` carries the unit
    // union for the still-batched Aggregate lens (Tension). Each lens reads only its field.
    return {
      findings: [
        {
          noticing: 'A pattern runs across the surfaced findings.',
          sourceFindingId: priorFindings[0].findingId,
          sourceFindingIds: priorFindings.map((f) => f.findingId),
          evidenceUnitIds: unitIds,
        },
      ],
    };
  }
  if (payload.units.length === 0) {
    return { findings: [] };
  }
  // The surfacing Evidence emit lens that reads the units directly (Listening): surface
  // ONE finding (`verbatim`) that cites every unit it was given — so the derived support
  // set spans all the distinct sources.
  return {
    findings: [
      {
        verbatim: 'A recurring signal runs across the comments.',
        evidenceUnitIds: payload.units.map((u) => u.unitId),
      },
    ],
  };
}
