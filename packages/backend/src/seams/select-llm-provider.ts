import { FakeLlmProvider, type LlmProvider } from './llm-provider.js';
import { AnthropicLlmProvider } from './anthropic-llm-provider.js';

// Env-driven provider selection for a DEV / eval entry point. Deliberately NOT used by
// buildContainer, which stays pure (the silent fake by default) so the whole test suite
// runs green with no key and no network. This is the one place the env-read with
// fake-fallback lives: a key present -> the real Anthropic provider; absent -> the fake.

/** True when a usable Anthropic API key is present in the environment. */
export function hasAnthropicKey(): boolean {
  return (process.env.ANTHROPIC_API_KEY ?? '').trim() !== '';
}

/**
 * Choose the LLM provider from the environment: the real Anthropic provider when
 * ANTHROPIC_API_KEY is set, otherwise the deterministic fake (so the harness still
 * runs end to end with no key — it just exercises the fake, not the model).
 */
export function selectLlmProvider(): LlmProvider {
  return hasAnthropicKey() ? new AnthropicLlmProvider() : new FakeLlmProvider();
}
