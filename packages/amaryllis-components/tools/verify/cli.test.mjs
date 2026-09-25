import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { runCli } from './cli.mjs';
import { evaluateCompatibility } from './policy.mjs';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolDirectory, '../../../..');
const exampleDirectory = path.join(repositoryRoot, 'docs/examples/verify');

const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);
const DIGEST_C = 'c'.repeat(64);

function clone(value) {
  return structuredClone(value);
}

async function readExample(name) {
  return JSON.parse(
    await fs.readFile(path.join(exampleDirectory, name), 'utf8')
  );
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function capture() {
  let stdout = '';
  let stderr = '';
  return {
    options: {
      stdout: (text) => {
        stdout += text;
      },
      stderr: (text) => {
        stderr += text;
      },
    },
    stdout: () => stdout,
    stderr: () => stderr,
  };
}

function makeManifest() {
  return {
    apiVersion: 'amaryllis.dev/verify/v1alpha1',
    kind: 'VerificationManifest',
    metadata: { name: 'cli-test' },
    subject: {
      application: {
        id: 'com.example.verify',
        version: '1.0.0',
        digest: { algorithm: 'sha256', value: DIGEST_A },
      },
      runtime: {
        package: '@micrantha/react-native-amaryllis',
        version: '0.1.7',
        digest: { algorithm: 'sha256', value: DIGEST_B },
      },
      model: {
        id: 'test-model',
        version: '1',
        format: 'mediapipe-task',
        digest: { algorithm: 'sha256', value: DIGEST_C },
      },
    },
    target: {
      platform: 'android',
      requiredCapabilities: ['physical-device'],
    },
    scenario: {
      id: 'cli-smoke',
      version: '1.0.0',
      timeoutMs: 1000,
      warmupRuns: 0,
      repetitions: 1,
    },
    collect: {
      metrics: ['timing.initialization.ms'],
      checks: [],
      evaluations: [],
    },
    policy: {
      requirements: [
        {
          id: 'startup',
          severity: 'required',
          target: {
            kind: 'metric',
            name: 'timing.initialization.ms',
          },
          operator: 'lte',
          value: 2000,
          aggregate: 'max',
          unit: 'ms',
        },
      ],
    },
  };
}

function makeAdapterScript(value = 1000) {
  return {
    environment: {
      platform: 'android',
      os: { name: 'Android', version: '15' },
      device: {
        manufacturer: 'Google',
        model: 'Pixel 8',
        architecture: 'arm64-v8a',
        capabilities: ['physical-device'],
      },
    },
    collectors: [{ name: 'timing', version: 'v1alpha1' }],
    iterations: [
      {
        measurements: [
          {
            name: 'timing.initialization.ms',
            unit: 'ms',
            value,
          },
        ],
      },
    ],
  };
}

async function withTemporaryDirectory(t) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'amaryllis-verify-cli-'));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  return temporary;
}

test('validate accepts valid evidence', async (t) => {
  const temporary = await withTemporaryDirectory(t);
  const evidencePath = path.join(temporary, 'evidence.json');
  await writeJson(evidencePath, await readExample('android.evidence.json'));
  const output = capture();

  const code = await runCli(['validate', '--evidence', evidencePath], output.options);

  assert.equal(code, 0);
  assert.equal(output.stdout(), 'valid\n');
  assert.equal(output.stderr(), '');
});

test('validate rejects schema-invalid evidence', async (t) => {
  const temporary = await withTemporaryDirectory(t);
  const evidence = await readExample('android.evidence.json');
  evidence.prompt = 'must not be retained';
  const evidencePath = path.join(temporary, 'evidence.json');
  await writeJson(evidencePath, evidence);
  const output = capture();

  const code = await runCli(['validate', '--evidence', evidencePath], output.options);

  assert.equal(code, 64);
  assert.match(output.stderr(), /additionalProperties/);
});

test('check maps warn to zero and unknown to three', async (t) => {
  const temporary = await withTemporaryDirectory(t);
  const androidPath = path.join(temporary, 'android.json');
  const iosPath = path.join(temporary, 'ios.json');
  await writeJson(androidPath, await readExample('android.evidence.json'));
  await writeJson(iosPath, await readExample('ios.evidence.json'));

  assert.equal(
    await runCli(['check', '--evidence', androidPath], capture().options),
    0
  );
  assert.equal(
    await runCli(['check', '--evidence', iosPath], capture().options),
    3
  );
});

test('check maps a required compatibility violation to two', async (t) => {
  const temporary = await withTemporaryDirectory(t);
  const evidence = await readExample('android.evidence.json');
  const startup = evidence.policy.requirements.find(({ id }) => id === 'startup-budget');
  startup.value = 500;
  evidence.decision = evaluateCompatibility(evidence);
  const evidencePath = path.join(temporary, 'fail.json');
  await writeJson(evidencePath, evidence);

  assert.equal(
    await runCli(['check', '--evidence', evidencePath], capture().options),
    2
  );
});

test('check rejects a tampered embedded decision', async (t) => {
  const temporary = await withTemporaryDirectory(t);
  const evidence = await readExample('ios.evidence.json');
  evidence.decision = { status: 'pass', reasons: [] };
  const evidencePath = path.join(temporary, 'tampered.json');
  await writeJson(evidencePath, evidence);
  const output = capture();

  const code = await runCli(['check', '--evidence', evidencePath], output.options);

  assert.equal(code, 64);
  assert.match(output.stderr(), /does not match/);
});

test('check blocks incomplete execution even when compatibility evidence passes', async (t) => {
  const temporary = await withTemporaryDirectory(t);
  const evidence = await readExample('android.evidence.json');
  evidence.policy.requirements = evidence.policy.requirements.filter(
    ({ id }) => id !== 'thermal-observation'
  );
  evidence.unavailable = [];
  evidence.execution.status = 'partial';
  evidence.decision = evaluateCompatibility(evidence);
  assert.equal(evidence.decision.status, 'pass');
  const evidencePath = path.join(temporary, 'partial.json');
  await writeJson(evidencePath, evidence);

  assert.equal(
    await runCli(['check', '--evidence', evidencePath], capture().options),
    3
  );
});

test('missing input and malformed JSON are invalid input, not internal failures', async (t) => {
  const temporary = await withTemporaryDirectory(t);
  const missing = path.join(temporary, 'missing.json');
  const malformed = path.join(temporary, 'malformed.json');
  await fs.writeFile(malformed, '{not-json', 'utf8');

  assert.equal(
    await runCli(['validate', '--evidence', missing], capture().options),
    64
  );
  assert.equal(
    await runCli(['validate', '--evidence', malformed], capture().options),
    64
  );
});

test('remote-looking CLI paths are rejected', async () => {
  assert.equal(
    await runCli(
      ['validate', '--evidence', 'https://example.invalid/evidence.json'],
      capture().options
    ),
    64
  );
});

test('run writes valid passing evidence and returns zero', async (t) => {
  const temporary = await withTemporaryDirectory(t);
  const manifestPath = path.join(temporary, 'manifest.json');
  const adapterPath = path.join(temporary, 'adapter.json');
  const outputPath = path.join(temporary, 'evidence.json');
  await writeJson(manifestPath, makeManifest());
  await writeJson(adapterPath, makeAdapterScript(1000));
  const output = capture();

  const code = await runCli(
    [
      'run',
      '--manifest',
      manifestPath,
      '--output',
      outputPath,
      '--adapter-script',
      adapterPath,
    ],
    output.options
  );

  assert.equal(code, 0);
  const evidence = JSON.parse(await fs.readFile(outputPath, 'utf8'));
  assert.equal(evidence.execution.status, 'completed');
  assert.equal(evidence.decision.status, 'pass');
  assert.match(output.stdout(), /execution=completed, decision=pass/);
});

test('run returns zero when valid evidence has a compatibility fail decision', async (t) => {
  const temporary = await withTemporaryDirectory(t);
  const manifestPath = path.join(temporary, 'manifest.json');
  const adapterPath = path.join(temporary, 'adapter.json');
  const outputPath = path.join(temporary, 'evidence.json');
  await writeJson(manifestPath, makeManifest());
  await writeJson(adapterPath, makeAdapterScript(3000));

  const code = await runCli(
    [
      'run',
      '--manifest',
      manifestPath,
      '--output',
      outputPath,
      '--adapter-script',
      adapterPath,
    ],
    capture().options
  );

  assert.equal(code, 0);
  const evidence = JSON.parse(await fs.readFile(outputPath, 'utf8'));
  assert.equal(evidence.decision.status, 'fail');
});

test('run returns seventy and does not create evidence when target setup cannot start', async (t) => {
  const temporary = await withTemporaryDirectory(t);
  const manifestPath = path.join(temporary, 'manifest.json');
  const adapterPath = path.join(temporary, 'adapter.json');
  const outputPath = path.join(temporary, 'evidence.json');
  await writeJson(manifestPath, makeManifest());
  await writeJson(adapterPath, {
    ...makeAdapterScript(),
    failure: {
      phase: 'capabilities',
      message: 'target unavailable',
    },
  });

  const code = await runCli(
    [
      'run',
      '--manifest',
      manifestPath,
      '--output',
      outputPath,
      '--adapter-script',
      adapterPath,
    ],
    capture().options
  );

  assert.equal(code, 70);
  await assert.rejects(() => fs.access(outputPath));
});

test('run rejects invalid manifest as input error', async (t) => {
  const temporary = await withTemporaryDirectory(t);
  const manifest = makeManifest();
  manifest.policy.requirements = [];
  const manifestPath = path.join(temporary, 'manifest.json');
  const adapterPath = path.join(temporary, 'adapter.json');
  const outputPath = path.join(temporary, 'evidence.json');
  await writeJson(manifestPath, manifest);
  await writeJson(adapterPath, makeAdapterScript());

  const code = await runCli(
    [
      'run',
      '--manifest',
      manifestPath,
      '--output',
      outputPath,
      '--adapter-script',
      adapterPath,
    ],
    capture().options
  );

  assert.equal(code, 64);
  await assert.rejects(() => fs.access(outputPath));
});

test('missing required CLI options return usage error', async () => {
  assert.equal(await runCli(['run'], capture().options), 64);
});
