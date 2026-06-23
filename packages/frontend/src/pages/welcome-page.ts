import { CONTRACT_INFO, type ContractInfo } from '@humanlens/shared';

export class WelcomePage {
  public message = 'Welcome to Aurelia 2!';
  // Pulled from the shared contract package — proves the cross-package import.
  public readonly contract: ContractInfo = CONTRACT_INFO;
}
