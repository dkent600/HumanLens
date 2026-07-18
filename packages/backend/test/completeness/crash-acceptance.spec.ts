import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { Ledger } from '../../src/eval/completeness/ledger.js';
import { PROPERTIES } from '../../src/engine/completeness/properties.js';

// The CRASH ACCEPTANCE TEST (build_context.md acceptance: "SIGKILL at 50% → restart →
// perfect resume"). It is an integration test — a real child process, a real durable
// file ledger, a real hard kill — so it builds the dist once and drives the compiled
// crash-harness, proving P8 against the ACTUAL ledger/fan-out, not an in-process stand-in.

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(here, '..', '..'); // packages/backend
const harness = join(backendRoot, 'dist', 'eval', 'completeness', 'crash-harness.js');

const N = 20; // voices in the run
const KILL_AFTER = 10; // crash after exactly half are durably committed

let workDir: string;

beforeAll(() => {
  // Build the completeness dist so the child runs the REAL compiled code (incremental,
  // fast after the first build). Mirrors how `npm run eval` / `npm run completeness` run.
  execSync('npx tsc -b', { cwd: backendRoot, stdio: 'pipe' });
  workDir = mkdtempSync(join(tmpdir(), 'humanlens-crash-'));
}, 120_000);

afterAll(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

/** Run phase 1 and SIGKILL the child the instant it reports it has paused at the crash point. */
function runPhase1(dbPath: string, runId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [harness, dbPath, runId, '1', String(KILL_AFTER), String(N)]);
    let out = '';
    let killed = false;
    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString();
      if (!killed && out.includes('PAUSED')) {
        killed = true;
        child.kill('SIGKILL'); // the crash — child was mid-run, ledger not closed
      }
    });
    child.on('error', reject);
    child.on('exit', () => {
      // We expect an abnormal exit (killed by signal). Either way, phase 1 is over.
      if (killed) resolve();
      else reject(new Error(`phase 1 exited before pausing; output:\n${out}`));
    });
  });
}

/** Run phase 2 (resume) and resolve when it finishes cleanly. */
function runPhase2(dbPath: string, runId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [harness, dbPath, runId, '2', '0', String(N)]);
    let out = '';
    child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()));
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0 && out.includes('DONE')) resolve();
      else reject(new Error(`phase 2 did not complete cleanly (code ${code}); output:\n${out}`));
    });
  });
}

describe(`P8 — ${PROPERTIES.P8.title} (SIGKILL at 50% → restart → perfect resume)`, () => {
  it('restores totality on restart, re-runs nothing already completed, and loses no findings', async () => {
    const dbPath = join(workDir, 'ledger.sqlite');
    const runId = 'run:crash';

    await runPhase1(dbPath, runId); // commits voice:0..9 durably, then is killed
    await runPhase2(dbPath, runId); // resumes and completes voice:10..19

    const ledger = new Ledger(dbPath);
    try {
      // Totality restored: every voice terminal, every one answered-with-findings, all findings present.
      const rows = ledger.allRows(runId);
      expect(rows).toHaveLength(N);
      for (const row of rows) {
        expect(row.state).toBe('answered-with-findings');
      }
      expect(ledger.findingCount(runId)).toBe(N);

      // No re-execution (P8): the first half committed pre-crash was NOT called again in
      // phase 2; the second half was untouched pre-crash and only ran in phase 2.
      for (let i = 0; i < N; i += 1) {
        const voiceId = `voice:${i}`;
        if (i < KILL_AFTER) {
          expect(ledger.callCount(runId, voiceId, 1)).toBeGreaterThanOrEqual(1); // done pre-crash
          expect(ledger.callCount(runId, voiceId, 2)).toBe(0); // NOT re-run on resume
        } else {
          expect(ledger.callCount(runId, voiceId, 1)).toBe(0); // never reached pre-crash
          expect(ledger.callCount(runId, voiceId, 2)).toBeGreaterThanOrEqual(1); // completed on resume
        }
      }
    } finally {
      ledger.close();
    }
  }, 60_000);
});
