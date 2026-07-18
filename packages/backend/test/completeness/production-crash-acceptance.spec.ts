import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { SqliteRunLedger } from '../../src/seams/run-ledger.js';
import { PROPERTIES } from '../../src/engine/completeness/properties.js';

// The PRODUCTION crash acceptance test (P8): SIGKILL at 50% → restart → perfect resume,
// against the PRODUCTION orchestrator + SqliteRunLedger. A real child process, a real
// durable file ledger, a real hard kill — so it builds the dist once and drives the
// compiled harness, proving P8 on the production machinery, not an in-process stand-in.

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(here, '..', '..'); // packages/backend
const harness = join(backendRoot, 'dist', 'eval', 'completeness', 'prod-crash-harness.js');

const N = 20;
const KILL_AFTER = 10;

let workDir: string;

beforeAll(() => {
  execSync('npx tsc -b', { cwd: backendRoot, stdio: 'pipe' });
  workDir = mkdtempSync(join(tmpdir(), 'humanlens-prod-crash-'));
}, 120_000);

afterAll(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

function runPhase1(dbPath: string, runId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [harness, dbPath, runId, '1', String(KILL_AFTER), String(N)]);
    let out = '';
    let killed = false;
    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString();
      if (!killed && out.includes('PAUSED')) {
        killed = true;
        child.kill('SIGKILL');
      }
    });
    child.on('error', reject);
    child.on('exit', () => {
      if (killed) resolve();
      else reject(new Error(`phase 1 exited before pausing; output:\n${out}`));
    });
  });
}

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

describe(`P8 — ${PROPERTIES.P8.title} (production: SIGKILL at 50% → restart → perfect resume)`, () => {
  it('restores totality on restart, re-runs nothing already completed, and loses no findings', async () => {
    const dbPath = join(workDir, 'run-ledger.sqlite');
    const runId = 'run:crash';

    await runPhase1(dbPath, runId);
    await runPhase2(dbPath, runId);

    const ledger = new SqliteRunLedger(dbPath);
    try {
      const rows = await ledger.allRows(runId);
      expect(rows).toHaveLength(N);
      for (const row of rows) expect(row.state).toBe('answered-with-findings');
      expect(await ledger.findingCount(runId)).toBe(N);

      for (let i = 0; i < N; i += 1) {
        const voiceId = `voice:${i}`;
        if (i < KILL_AFTER) {
          expect(await ledger.callCount(runId, voiceId, 1)).toBeGreaterThanOrEqual(1);
          expect(await ledger.callCount(runId, voiceId, 2)).toBe(0); // NOT re-run on resume
        } else {
          expect(await ledger.callCount(runId, voiceId, 1)).toBe(0);
          expect(await ledger.callCount(runId, voiceId, 2)).toBeGreaterThanOrEqual(1);
        }
      }
    } finally {
      ledger.close();
    }
  }, 60_000);
});
