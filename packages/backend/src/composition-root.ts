import { asFunction, asValue, createContainer, type AwilixContainer } from 'awilix';
import type { Actor } from './domain/types.js';
import { AllowAllAuthorization, type AuthorizationSeam } from './seams/authorization.js';
import { AssumedIdentity, type IdentitySeam } from './seams/identity.js';
import { InMemoryUnitRepository, type UnitRepository } from './seams/repository.js';
import { TrivialDeidDetector, type DeidDetector } from './seams/deid-detector.js';
import { FakeLlmProvider, type LlmProvider } from './seams/llm-provider.js';
import { IntakeService } from './engine/intake.js';
import { BriefService } from './engine/brief-service.js';
import { DeidGate } from './engine/deid-gate.js';
import { ListeningLens } from './engine/lenses/listening-lens.js';
import { HumanMeaningLens } from './engine/lenses/human-meaning-lens.js';
import { TensionLens } from './engine/lenses/tension-lens.js';
import { CulturePatternLens } from './engine/lenses/culture-pattern-lens.js';
import { ObjectiveLens } from './engine/lenses/objective-lens.js';
import { DiscernmentLens } from './engine/lenses/discernment-lens.js';
import { OpeningLens } from './engine/lenses/opening-lens.js';
import { LensPipeline } from './engine/lens-pipeline.js';

/** The single assumed actor for V1 (no sign-in yet). */
export const ASSUMED_ACTOR: Actor = {
  id: 'actor:inclusity-staff',
  displayName: 'Inclusity Staff',
};

export interface AppContainer {
  identity: IdentitySeam;
  authorization: AuthorizationSeam;
  unitRepository: UnitRepository;
  deidDetector: DeidDetector;
  llmProvider: LlmProvider;
  intakeService: IntakeService;
  briefService: BriefService;
  deidGate: DeidGate;
  listeningLens: ListeningLens;
  humanMeaningLens: HumanMeaningLens;
  tensionLens: TensionLens;
  culturePatternLens: CulturePatternLens;
  objectiveLens: ObjectiveLens;
  discernmentLens: DiscernmentLens;
  openingLens: OpeningLens;
  lensPipeline: LensPipeline;
}

/**
 * Optional overrides for `buildContainer`. The only override the build cycle needs
 * is the LLM provider: the dev bootstrap injects a fixture/demo fake that promotes a
 * subset of findings so there is a non-empty client-safe layer to render. It is an
 * EXPLICIT caller-supplied override precisely so the promoting fake never lands in
 * the default wiring — `buildContainer()` with no args stays the silent default, and
 * the held-by-default proofs that rely on it keep passing.
 */
export interface BuildContainerOptions {
  /** Defaults to the silent `FakeLlmProvider` (promotes nothing). */
  readonly llmProvider?: LlmProvider;
}

/**
 * The composition root: the ONE place that wires the seams to concrete
 * implementations. Explicit registration — no decorators, no reflect-metadata.
 * This is where the platform layer would later swap real policy in behind the
 * identity and authorization seams.
 */
export function buildContainer(options: BuildContainerOptions = {}): AwilixContainer<AppContainer> {
  const container = createContainer<AppContainer>();
  container.register({
    identity: asValue(new AssumedIdentity(ASSUMED_ACTOR)),
    authorization: asValue(new AllowAllAuthorization()),
    unitRepository: asValue(new InMemoryUnitRepository()),
    deidDetector: asValue(new TrivialDeidDetector()),
    llmProvider: asValue(options.llmProvider ?? new FakeLlmProvider()),
    intakeService: asFunction(
      ({ authorization, unitRepository }: AppContainer) =>
        new IntakeService(authorization, unitRepository),
    ).singleton(),
    briefService: asFunction(
      ({ authorization, unitRepository, lensPipeline }: AppContainer) =>
        new BriefService(authorization, unitRepository, lensPipeline),
    ).singleton(),
    deidGate: asFunction(
      ({ deidDetector, unitRepository }: AppContainer) =>
        new DeidGate(deidDetector, unitRepository),
    ).singleton(),
    listeningLens: asFunction(() => new ListeningLens()).singleton(),
    humanMeaningLens: asFunction(() => new HumanMeaningLens()).singleton(),
    tensionLens: asFunction(() => new TensionLens()).singleton(),
    culturePatternLens: asFunction(() => new CulturePatternLens()).singleton(),
    objectiveLens: asFunction(() => new ObjectiveLens()).singleton(),
    discernmentLens: asFunction(() => new DiscernmentLens()).singleton(),
    openingLens: asFunction(() => new OpeningLens()).singleton(),
    lensPipeline: asFunction(
      // Registered in layer order for readability; the pipeline groups by each
      // lens's declared layer and runs the layers in LAYER_ORDER regardless. The full
      // seven-lens set: Listening + Human Meaning are both Evidence — independent
      // siblings in one layer; Tension and Culture Pattern are both Aggregate;
      // Objective (Interpret) runs after them and before Discernment (Guardrail), so
      // Discernment audits its findings. Opening (Openings) runs LAST — after
      // Discernment — so its findings are never audited and stay held internal-only
      // (their promoter is human review, deferred).
      ({
        deidGate,
        llmProvider,
        listeningLens,
        humanMeaningLens,
        tensionLens,
        culturePatternLens,
        objectiveLens,
        discernmentLens,
        openingLens,
      }: AppContainer) =>
        new LensPipeline(deidGate, llmProvider, [
          listeningLens,
          humanMeaningLens,
          tensionLens,
          culturePatternLens,
          objectiveLens,
          discernmentLens,
          openingLens,
        ]),
    ).singleton(),
  });
  return container;
}
