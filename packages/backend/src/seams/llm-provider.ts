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

export interface LensPromptPayload {
  readonly instruction: string;
  readonly units: readonly LensPromptUnit[];
  /**
   * Findings produced by prior layers. Omitted/empty for Evidence-layer lenses
   * (which read units directly); present for lenses that build on earlier ones.
   */
  readonly priorFindings?: readonly LensPromptFinding[];
}

export interface LensResponseCandidate {
  readonly content: string;
  readonly evidenceUnitIds: readonly string[];
}

export interface LensResponsePayload {
  readonly findings: readonly LensResponseCandidate[];
}

/**
 * A deterministic stand-in for a real model — fixed, predictable output so lens
 * behavior is testable and reproducible without choosing a vendor. It plays the
 * role a prompted model would: it reads the lens's JSON prompt and returns the
 * findings JSON the lens asked for.
 *
 * Two default rules, selected by the payload shape so ONE fake drives both an
 * Evidence-layer lens and a later lens reproducibly:
 *   - With prior findings (an Aggregate+ call): surface ONE finding that cites the
 *     units BEHIND those prior findings — proving the later stage read the prior
 *     findings, not just the units, and that interpretive output stays anchored.
 *   - Otherwise (the Listening lens's case): surface ONE recurring-theme finding
 *     that cites every unit it was given — so the derived support set spans all the
 *     distinct sources, exercising honest cross-source counting.
 * With nothing to work from it returns no findings. A custom `respond` can script
 * other shapes for tests.
 */
export class FakeLlmProvider implements LlmProvider {
  constructor(
    private readonly respond: (payload: LensPromptPayload) => LensResponsePayload = defaultFakeResponse,
  ) {}

  complete(request: LlmRequest): Promise<LlmResponse> {
    const payload = JSON.parse(request.prompt) as LensPromptPayload;
    const response = this.respond(payload);
    return Promise.resolve({ text: JSON.stringify(response) });
  }
}

function defaultFakeResponse(payload: LensPromptPayload): LensResponsePayload {
  const priorFindings = payload.priorFindings ?? [];
  if (priorFindings.length > 0) {
    // An Aggregate+ call: anchor to the units behind the prior findings (deduped),
    // so the output is provably derived from what earlier stages found.
    const unitIds = [...new Set(priorFindings.flatMap((f) => f.evidenceUnitIds))];
    if (unitIds.length === 0) {
      return { findings: [] };
    }
    return {
      findings: [
        {
          content: 'A tension runs between the surfaced themes.',
          evidenceUnitIds: unitIds,
        },
      ],
    };
  }
  if (payload.units.length === 0) {
    return { findings: [] };
  }
  return {
    findings: [
      {
        content: 'A recurring theme runs across the comments.',
        evidenceUnitIds: payload.units.map((u) => u.unitId),
      },
    ],
  };
}
