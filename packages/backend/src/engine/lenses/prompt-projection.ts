import type { Finding } from '../../domain/finding.js';
import type { LensPromptFinding } from '../../seams/llm-provider.js';

// Shared bridge from a domain Finding to its lens↔model prompt projection. Lenses
// that read prior findings (Aggregate and beyond) all hand the model the same
// shape, carrying each finding's unit anchors so a later lens can follow a finding
// back to the units behind it.

/**
 * Project a domain finding into the shared lens-prompt convention.
 *
 * ⚠️ LOAD-BEARING — this is the ONE place the pipeline's working text resolves to
 * English. A downstream lens reads `translation` when present (the original wasn't
 * English) and otherwise `verbatim` (already English); `?? ''` covers an absence
 * finding's null verbatim. `verbatim` itself always travels on the Finding, so the
 * original words are never lost — but no lens reads the raw finding text directly; they
 * read this projection, so the resolution lives here and nowhere else. Do not have a
 * lens key off `verbatim`/`translation` itself, or the English-working-text guarantee
 * splinters across call sites.
 */
export function toPromptFinding(finding: Finding): LensPromptFinding {
  return {
    findingId: finding.findingId,
    lens: finding.lens,
    content: finding.translation ?? finding.verbatim ?? '',
    evidenceUnitIds: [...finding.evidenceLinks],
  };
}
