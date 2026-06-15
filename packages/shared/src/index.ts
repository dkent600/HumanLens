// @humanlens/shared — the client-safe contract shared by frontend and backend.
//
// The client-safe layer is a filtered, voice-calibrated projection of the
// internal finding set (client-safe ⊆ internal), with evidence links preserved.
// The DTO / contract types that cross the wire from backend to frontend will
// live here so both sides import one definition.
//
// For now this carries a single placeholder value so the cross-package import
// is exercised end-to-end; real contract types replace it as the model lands.

export interface ContractInfo {
  /** The Human Lens module this contract serves. */
  readonly module: string;
  /** Contract revision — bumped when the wire shape changes. */
  readonly contractVersion: string;
}

export const CONTRACT_INFO: ContractInfo = {
  module: 'listening-brief',
  contractVersion: '0',
};
