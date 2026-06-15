import { asFunction, asValue, createContainer, type AwilixContainer } from 'awilix';
import type { Actor } from './domain/types.js';
import { AllowAllAuthorization, type AuthorizationSeam } from './seams/authorization.js';
import { AssumedIdentity, type IdentitySeam } from './seams/identity.js';
import { InMemoryUnitRepository, type UnitRepository } from './seams/repository.js';
import { TrivialDeidDetector, type DeidDetector } from './seams/deid-detector.js';
import { IntakeService } from './engine/intake.js';
import { DeidGate } from './engine/deid-gate.js';

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
  intakeService: IntakeService;
  deidGate: DeidGate;
}

/**
 * The composition root: the ONE place that wires the seams to concrete
 * implementations. Explicit registration — no decorators, no reflect-metadata.
 * This is where the platform layer would later swap real policy in behind the
 * identity and authorization seams.
 */
export function buildContainer(): AwilixContainer<AppContainer> {
  const container = createContainer<AppContainer>();
  container.register({
    identity: asValue(new AssumedIdentity(ASSUMED_ACTOR)),
    authorization: asValue(new AllowAllAuthorization()),
    unitRepository: asValue(new InMemoryUnitRepository()),
    deidDetector: asValue(new TrivialDeidDetector()),
    intakeService: asFunction(
      ({ authorization, unitRepository }: AppContainer) =>
        new IntakeService(authorization, unitRepository),
    ).singleton(),
    deidGate: asFunction(
      ({ deidDetector, unitRepository }: AppContainer) =>
        new DeidGate(deidDetector, unitRepository),
    ).singleton(),
  });
  return container;
}
