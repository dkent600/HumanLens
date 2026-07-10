import Anthropic from '@anthropic-ai/sdk';
import { hasAnthropicKey } from '../../../seams/select-llm-provider.js';
import { SAMPLE_UNITS } from '../../sample-units.js';
import type { VoiceContent } from './anthropic-voice-model.js';

// Shared helpers for the F1/F2/F3 real-model falsifier harnesses. These harnesses spend
// real money against claude-opus-4-8 — they are run BY DOUG, deliberately (never on the
// eval-agent's own initiative). Each harness prints its call count up front so the spend
// is visible before the work happens.

/** Every sample voice as a per-voice work item (voiceId = unit id, the provenance anchor). */
export function sampleVoices(): VoiceContent[] {
  return SAMPLE_UNITS.map((u) => ({ voiceId: u.unitId, content: u.content }));
}

/**
 * The u9-focused set: the diagnosed silent-drop voice plus neighbours that stress the
 * empty / flag path (where a "drop" would hide as a spurious empty). Small, so ≥50 reps
 * stays affordable.
 */
export function u9FocusVoices(): VoiceContent[] {
  const ids = new Set(['eval-u0', 'eval-u3', 'eval-u4', 'eval-u9', 'eval-u10', 'eval-u17']);
  return sampleVoices().filter((v) => ids.has(v.voiceId));
}

/** Construct the real Anthropic client, or exit with guidance if no key is configured. */
export function requireClient(): Anthropic {
  if (!hasAnthropicKey()) {
    console.error(
      'No ANTHROPIC_API_KEY found. The F1/F2/F3 falsifiers require the real model.\n' +
        'Set ANTHROPIC_API_KEY in packages/backend/.env (loaded via --env-file-if-exists) and re-run.',
    );
    process.exit(1);
  }
  return new Anthropic();
}
