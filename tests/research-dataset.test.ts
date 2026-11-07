import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const validator = path.join(root, 'scripts/research/validate_dataset.py');
const python = process.env.PYTHON ?? (process.platform === 'win32' ? 'py' : 'python3');
const pythonArgs = process.platform === 'win32' ? ['-3', validator] : [validator];

function record(sampleId: string, split: 'train' | 'validation' | 'test', suffix: string) {
  return {
    schemaVersion: 1,
    datasetVersion: 'dev-1',
    sampleId,
    split,
    groups: {
      sessionGroupId: `session-${suffix}`,
      speakerGroupId: `speaker-${suffix}`,
      paraphraseFamilyId: `family-${suffix}`,
    },
    task: 'routing',
    language: 'en-US',
    reference: `synthetic reference ${sampleId}`,
    routeLabel: 'local_accept',
    actionAllowed: true,
    policy: {
      sourceId: 'synthetic-source',
      offlineStrict: true,
      generation: 1,
      maxCost: 0,
      allowedDestinations: ['local'],
    },
    consent: {
      status: 'granted',
      reference: `synthetic-consent-${sampleId}`,
      purposes: ['development-test'],
      expiresAt: '2099-01-01',
    },
    origin: { source: 'synthetic-test-fixture', license: 'CC0-1.0' },
    contentSha256: 'a'.repeat(64),
    ...(split === 'test' ? { testFrozen: true } : {}),
  };
}

async function runValidator(rows: object[]) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'polyglot-dataset-validator-'));
  const jsonlPath = path.join(directory, 'synthetic.jsonl');
  try {
    await writeFile(jsonlPath, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
    const result = spawnSync(python, [...pythonArgs, jsonlPath], { encoding: 'utf8' });
    if (result.error) throw result.error;
    return {
      status: result.status,
      output: JSON.parse(result.stdout) as { valid: boolean; issues: Array<{ code: string }> },
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe('research dataset validation scaffold', () => {
  it('accepts synthetic records with consent, provenance, references and isolated splits', async () => {
    const result = await runValidator([
      record('sample-train', 'train', '1'),
      record('sample-validation', 'validation', '2'),
      record('sample-test', 'test', '3'),
    ]);
    expect(result.status).toBe(0);
    expect(result.output).toMatchObject({ valid: true, records: 3, issues: [] });
  });

  it('rejects group leakage and ungranted consent without printing sample text', async () => {
    const invalid = record('sample-validation', 'validation', '1');
    invalid.consent.status = 'revoked';
    const result = await runValidator([
      record('sample-train', 'train', '1'),
      invalid,
      record('sample-test', 'test', '3'),
    ]);
    expect(result.status).toBe(1);
    expect(result.output.issues.map(({ code }) => code)).toContain('group_leakage:sessionGroupId');
    expect(result.output.issues.map(({ code }) => code)).toContain('consent_not_granted');
    expect(JSON.stringify(result.output)).not.toContain('synthetic reference');
  });

  it('reports malformed field types instead of crashing', async () => {
    const invalid = record('sample-validation', 'validation', '2');
    invalid.task = {} as string;
    invalid.policy.allowedDestinations = [{} as string];
    const result = await runValidator([
      record('sample-train', 'train', '1'),
      invalid,
      record('sample-test', 'test', '3'),
    ]);
    expect(result.status).toBe(1);
    expect(result.output.issues.map(({ code }) => code)).toContain('invalid_task');
    expect(result.output.issues.map(({ code }) => code)).toContain('invalid_allowed_destinations');
  });
});
