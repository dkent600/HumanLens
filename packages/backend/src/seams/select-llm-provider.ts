import { FakeLlmProvider, type LlmProvider } from './llm-provider.js';
import { AnthropicLlmProvider } from './anthropic-llm-provider.js';

// Env-driven provider selection for a DEV / eval entry point. Deliberately NOT used by
// buildContainer, which stays pure (the silent fake by default) so the whole test suite
// runs green with no key and no network. This is the one place the env-read with
// fake-fallback lives: a key present -> the real Anthropic provider; absent -> the fake.
//
// THE FAKE IS ASSERTABLE, NOT MERELY INFERRED. Key-absence alone is a poor way to ask for
// the fake: the eval scripts load packages/backend/.env on every invocation, so once a key
// lives there, "run without the key" stops being a repeatable action and becomes a
// delete-and-restore dance around a paid call. The harness's `--fake` states the intent
// instead, and OUTRANKS key detection — a switch a key sitting in a file could override
// would not be worth having.
//
// DELIBERATELY A PER-INVOCATION FLAG, NOT AN ENV VAR. An ambient switch can lurk in a shell
// and silently turn a REAL run fake — the mirror of the problem being fixed here, and a
// worse one, because a fake run that was meant to be real looks like a finished measurement.
// A flag is typed at the moment of use and cannot outlive it. Selection therefore reads the
// environment ONLY for the key; the force decision arrives as an argument from the caller.

/** True when a usable Anthropic API key is present in the environment. */
export function hasAnthropicKey(): boolean {
  return (process.env.ANTHROPIC_API_KEY ?? '').trim() !== '';
}

/**
 * WHICH provider was chosen and WHY. Separated from construction so a harness can DECLARE
 * its provenance in its output: "fake because forced" and "fake because no key" are the same
 * object but very different facts about a run, and a run that cannot say which is which
 * cannot be trusted as a baseline record.
 */
export type ProviderChoice = 'real' | 'fake-forced' | 'fake-no-key';

export function providerChoice(options: { readonly forceFake?: boolean } = {}): ProviderChoice {
  // Forcing wins over key detection — deliberately. See the header note.
  if (options.forceFake === true) {
    return 'fake-forced';
  }
  return hasAnthropicKey() ? 'real' : 'fake-no-key';
}

/**
 * Choose the LLM provider: the deterministic fake when explicitly forced (`forceFake`,
 * supplied by the harness's `--fake`), otherwise the real Anthropic provider when
 * ANTHROPIC_API_KEY is set, otherwise the fake (so a harness still runs end to end with no
 * key — it just exercises the fake, not the model).
 */
export function selectLlmProvider(options: { readonly forceFake?: boolean } = {}): LlmProvider {
  return providerChoice(options) === 'real' ? new AnthropicLlmProvider() : new FakeLlmProvider();
}
