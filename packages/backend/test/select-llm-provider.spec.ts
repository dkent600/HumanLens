import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hasAnthropicKey, providerChoice, selectLlmProvider } from '../src/seams/select-llm-provider.js';
import { FakeLlmProvider } from '../src/seams/llm-provider.js';

// Provider selection must be an ASSERTION, not an absence. The eval scripts load
// packages/backend/.env on every invocation, so once a key lives there "run without the
// key" is no longer a repeatable action — a fake run would mean deleting and restoring a
// file around a paid call. The harness's `--fake` states the intent, and must OUTRANK key
// detection: a switch a stray key could override would not be worth having.
//
// The force decision is a PER-INVOCATION ARGUMENT, never read from the environment. An
// ambient switch could lurk in a shell and silently turn a REAL run fake — worse than the
// problem it would solve, because a fake run meant to be real looks like a finished
// measurement. Selection reads the environment ONLY for the key; these tests therefore
// manipulate just ANTHROPIC_API_KEY.
//
// No test constructs the real provider (that would need a network); the 'real' cases assert
// the CHOICE, which is the branch that decides.

const KEY = 'ANTHROPIC_API_KEY';

describe('provider selection — forcing the fake outranks key detection', () => {
  let savedKey: string | undefined;

  beforeEach(() => {
    savedKey = process.env[KEY];
    delete process.env[KEY];
  });

  afterEach(() => {
    // Restore exactly — including "was absent", which is not the same as "is empty".
    if (savedKey === undefined) delete process.env[KEY];
    else process.env[KEY] = savedKey;
  });

  it('with no key and no flag: the fake, BECAUSE no key (the pre-existing behaviour)', () => {
    expect(hasAnthropicKey()).toBe(false);
    expect(providerChoice()).toBe('fake-no-key');
    expect(selectLlmProvider()).toBeInstanceOf(FakeLlmProvider);
  });

  it('with a key and no flag: the real provider (behaviour unchanged when the flag is absent)', () => {
    process.env[KEY] = 'sk-test-not-a-real-key';
    expect(hasAnthropicKey()).toBe(true);
    expect(providerChoice()).toBe('real');
  });

  it('THE POINT: a key present but forceFake (the harness --fake flag) still yields the fake', () => {
    process.env[KEY] = 'sk-test-not-a-real-key';
    expect(hasAnthropicKey()).toBe(true); // the key IS there...
    expect(providerChoice({ forceFake: true })).toBe('fake-forced'); // ...and is deliberately ignored
    expect(selectLlmProvider({ forceFake: true })).toBeInstanceOf(FakeLlmProvider);
  });

  it('distinguishes forced-fake from fallback-fake — the provenance a run must be able to declare', () => {
    expect(providerChoice({ forceFake: true })).toBe('fake-forced');
    expect(providerChoice()).toBe('fake-no-key');
    // Both are the fake; only the CHOICE says which fact about the run is true.
  });

  it('forceFake: false is NOT forcing — an explicit false must behave exactly like omitting it', () => {
    process.env[KEY] = 'sk-test-not-a-real-key';
    expect(providerChoice({ forceFake: false })).toBe('real');
    delete process.env[KEY];
    expect(providerChoice({ forceFake: false })).toBe('fake-no-key');
  });

  it('NO ambient switch: an env var cannot force the fake — only the caller can', () => {
    process.env[KEY] = 'sk-test-not-a-real-key';
    // A shell that happens to carry these must NOT divert a real run to the fake.
    for (const name of ['LLM_PROVIDER', 'FORCE_FAKE', 'USE_FAKE']) {
      const saved = process.env[name];
      process.env[name] = 'fake';
      expect(providerChoice()).toBe('real');
      if (saved === undefined) delete process.env[name];
      else process.env[name] = saved;
    }
  });

  it('treats a whitespace-only key as no key (a blank line in .env is not a credential)', () => {
    process.env[KEY] = '   ';
    expect(hasAnthropicKey()).toBe(false);
    expect(providerChoice()).toBe('fake-no-key');
  });
});
