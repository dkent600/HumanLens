import type { Finding } from '../../domain/finding.js';
import type { LensPromptFinding } from '../../seams/llm-provider.js';

// Shared bridge from a domain Finding to its lens↔model prompt projection. Lenses
// that read prior findings (Aggregate and beyond) all hand the model the same
// shape, carrying each finding's unit anchors so a later lens can follow a finding
// back to the units behind it.

/** Project a domain finding into the shared lens-prompt convention. */
export function toPromptFinding(finding: Finding): LensPromptFinding {
  return {
    findingId: finding.findingId,
    lens: finding.lens,
    content: finding.content,
    evidenceUnitIds: [...finding.evidenceLinks],
  };
}
