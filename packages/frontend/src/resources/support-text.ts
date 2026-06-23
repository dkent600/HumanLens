import { valueConverter } from 'aurelia';
import type { ClientSafeSupport } from '@humanlens/shared';

// Presentational formatting of a finding's DERIVED support. Strength is never an
// asserted label — it falls out of the evidence counts the backend already derived
// ("N comments across M sources", honest about sources vs. people). Formatting lives
// in the view (this converter), not in the Store.
@valueConverter('supportText')
export class SupportTextValueConverter {
  toView(support: ClientSafeSupport): string {
    const comments = `${support.unitCount} ${support.unitCount === 1 ? 'comment' : 'comments'}`;
    const sources = `${support.sourceCount} ${support.sourceCount === 1 ? 'source' : 'sources'}`;
    return `appears in ${comments} across ${sources}`;
  }
}
