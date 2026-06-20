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

export interface LensPromptPayload {
  readonly instruction: string;
  readonly units: readonly LensPromptUnit[];
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
 * Default rule (the Listening lens's case): surface ONE recurring-theme finding
 * that cites every unit it was given — so the derived support set spans all the
 * distinct sources, exercising honest cross-source counting. With no units, it
 * returns no findings. A custom `respond` can script other shapes for tests.
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
