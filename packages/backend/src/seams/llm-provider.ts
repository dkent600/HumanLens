// The LLM provider seam — the engine the lenses run on, kept behind a thin,
// swappable interface so the vendor (Anthropic, OpenAI, Google, ...) can change
// without touching call sites. The choice of provider is deliberately TBD.
//
// The seam is GENERIC and domain-agnostic: prompt in, text out. It knows nothing
// of units or findings — that keeps it reusable by every lens and every future
// module. A lens owns building its prompt and parsing the response; the provider
// only ferries text to and from "the model".

export interface LlmRequest {
  /** Optional system instruction (role/posture for the model). */
  readonly system?: string;
  /** The prompt the model is asked to complete. */
  readonly prompt: string;
}

export interface LlmResponse {
  readonly text: string;
}

export interface LlmProvider {
  complete(request: LlmRequest): Promise<LlmResponse>;
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
  readonly content: string;
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
 *   - With prior findings (an Aggregate+ emit call): surface ONE finding that cites
 *     the units BEHIND those prior findings — proving the later stage read the prior
 *     findings, not just the units, and that interpretive output stays anchored.
 *   - Otherwise (an Evidence-layer emit call — Listening, Human Meaning): surface ONE
 *     finding that cites every unit it was given — so the derived support set spans
 *     all the distinct sources, exercising honest cross-source counting.
 * With nothing to work from it returns no findings. A custom `respond` can script
 * other shapes for tests (e.g. a verdict that promotes or flags a finding).
 */
export class FakeLlmProvider implements LlmProvider {
  constructor(
    private readonly respond: (payload: LensPromptPayload) => FakeLensResponse = defaultFakeResponse,
  ) {}

  complete(request: LlmRequest): Promise<LlmResponse> {
    const payload = JSON.parse(request.prompt) as LensPromptPayload;
    const response = this.respond(payload);
    return Promise.resolve({ text: JSON.stringify(response) });
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
    // Any emit lens that reads prior findings (Aggregate: Tension, Culture Pattern;
    // Interpret: Inclusity Objective; Openings: Action Opening): anchor to the units
    // BEHIND the prior findings (deduped), so the output is provably derived from
    // what earlier stages found. Neutral content — it stands in for any such lens.
    const unitIds = [...new Set(priorFindings.flatMap((f) => f.evidenceUnitIds))];
    if (unitIds.length === 0) {
      return { findings: [] };
    }
    return {
      findings: [
        {
          content: 'A pattern runs across the surfaced findings.',
          evidenceUnitIds: unitIds,
        },
      ],
    };
  }
  if (payload.units.length === 0) {
    return { findings: [] };
  }
  // Any Evidence-layer emit lens that reads the units directly (Listening, Human
  // Meaning): surface ONE finding that cites every unit it was given — so the derived
  // support set spans all the distinct sources. Neutral content — it stands in for
  // any such lens.
  return {
    findings: [
      {
        content: 'A recurring signal runs across the comments.',
        evidenceUnitIds: payload.units.map((u) => u.unitId),
      },
    ],
  };
}
