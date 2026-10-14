import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { FakePlatformAdapter } from './fake-adapter.mjs';
import {
  loadDeclaredFixtures,
  runVerification,
  sanitizeEvidenceMessage,
  sha256Digest,
  VerifyRunnerError,
} from './runner.mjs';
import { loadVerifySchemaBundle, VerifyValidator } from './validator.mjs';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolDirectory, '../../../..');
const validator = new VerifyValidator(
  loadVerifySchemaBundle(path.join(repositoryRoot, 'schemas/verify/v1alpha1'))
);

const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);
const DIGEST_C = 'c'.repeat(64);

function makeEnvironment() {
  return {
    platform: 'android',
    os: {
      name: 'Android',
      version: '15',
    },
    device: {
      manufacturer: 'Google',
      model: 'Pixel 8',
      architecture: 'arm64-v8a',
      capabilities: ['physical-device'],
    },
  };
}

function makeManifest(overrides = {}) {
  const manifest = {
    apiVersion: 'amaryllis.dev/verify/v1alpha1',
    kind: 'VerificationManifest',
    metadata: {
      name: 'runner-test',
    },
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
      id: 'runner-smoke',
      version: '1.0.0',
      timeoutMs: 1000,
      warmupRuns: 1,
      repetitions: 3,
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

  return {
    ...manifest,
    ...overrides,
    scenario: {
      ...manifest.scenario,
      ...(overrides.scenario ?? {}),
    },
    collect: {
      ...manifest.collect,
      ...(overrides.collect ?? {}),
    },
    policy: overrides.policy ?? manifest.policy,
  };
}

function makeAdapterScript(overrides = {}) {
  return {
    environment: makeEnvironment(),
    collectors: [{ name: 'timing', version: 'v1alpha1' }],
    iterations: [
      {
        measurements: [
          { name: 'timing.initialization.ms', unit: 'ms', value: 1000 },
        ],
      },
      {
        measurements: [
          { name: 'timing.initialization.ms', unit: 'ms', value: 1100 },
        ],
      },
      {
        measurements: [
          { name: 'timing.initialization.ms', unit: 'ms', value: 1200 },
        ],
      },
    ],
    ...overrides,
  };
}

async function run(manifest, script, options = {}) {
  const adapter = new FakePlatformAdapter(script);
  const evidence = await runVerification({
    manifest,
    validator,
    adapter,
    baseDirectory: repositoryRoot,
    idFactory: () => 'verify-test-id',
    ...options,
  });
  return { evidence, adapter };
}

test('runs warmup and all repetitions and emits valid passing evidence', async () => {
  const { evidence, adapter } = await run(makeManifest(), makeAdapterScript());

  assert.equal(evidence.execution.status, 'completed');
  assert.deepEqual(evidence.execution.repetitions, {
    requested: 3,
    completed: 3,
  });
  assert.equal(evidence.decision.status, 'pass');
  assert.deepEqual(
    evidence.measurements[0].samples.map(({ value }) => value),
    [1000, 1100, 1200]
  );
  assert.deepEqual(evidence.measurements[0].summary, {
    count: 3,
    min: 1000,
    max: 1200,
    mean: 1100,
    p50: 1100,
    p95: 1190,
  });
  assert.equal(evidence.provenance.manifestDigest.algorithm, 'sha256');
  assert.match(evidence.provenance.manifestDigest.value, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    adapter.calls.map(({ phase, iteration }) =>
      iteration === undefined ? phase : `${phase}:${iteration}`
    ),
    ['capabilities', 'prepare', 'warmup:1', 'execute:1', 'execute:2', 'execute:3', 'cleanup']
  );
  assert.deepEqual(validator.validateEvidence(evidence), { valid: true, issues: [] });
});

test('undeclared adapter telemetry fails inside execute lifecycle and still cleans up', async () => {
  const { evidence, adapter } = await run(
    makeManifest(),
    makeAdapterScript({
      iterations: [
        {
          measurements: [
            { name: 'telemetry.secretMetric', unit: 'count', value: 1 },
          ],
        },
      ],
    })
  );

  assert.equal(evidence.execution.status, 'failed');
  assert.equal(evidence.execution.repetitions.completed, 0);
  assert.equal(evidence.decision.status, 'unknown');
  assert.deepEqual(evidence.measurements, []);
  assert.ok(
    evidence.errors.some(({ code }) => code === 'adapter.undeclared-target')
  );
  assert.ok(adapter.calls.some(({ phase }) => phase === 'cleanup'));
});

test('adapter failure stops later repetitions, cleans up, and emits partial evidence', async () => {
  const { evidence, adapter } = await run(
    makeManifest(),
    makeAdapterScript({
      failure: {
        phase: 'execute',
        iteration: 2,
        message: 'iteration failed',
      },
    })
  );

  assert.equal(evidence.execution.status, 'partial');
  assert.equal(evidence.execution.repetitions.completed, 1);
  assert.equal(evidence.measurements[0].samples.length, 1);
  assert.equal(evidence.decision.status, 'pass');
  assert.equal(
    adapter.calls.some(({ phase, iteration }) => phase === 'execute' && iteration === 3),
    false
  );
  assert.ok(adapter.calls.some(({ phase }) => phase === 'cleanup'));
});

test('overall timeout produces failed evidence, no later iterations, and cleanup', async () => {
  const manifest = makeManifest({
    scenario: {
      timeoutMs: 25,
      warmupRuns: 0,
      repetitions: 3,
    },
  });
  const { evidence, adapter } = await run(
    manifest,
    makeAdapterScript({
      delays: { executeMs: 100 },
    })
  );

  assert.equal(evidence.execution.status, 'failed');
  assert.equal(evidence.execution.repetitions.completed, 0);
  assert.equal(evidence.decision.status, 'unknown');
  assert.ok(evidence.errors.some(({ code }) => code === 'run-timeout'));
  assert.equal(
    adapter.calls.some(({ phase, iteration }) => phase === 'execute' && iteration === 2),
    false
  );
  assert.ok(adapter.calls.some(({ phase }) => phase === 'cleanup'));
});

test('external cancellation during prepare emits cancelled evidence and cleanup', async () => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 10);

  const { evidence, adapter } = await run(
    makeManifest({ scenario: { warmupRuns: 0 } }),
    makeAdapterScript({ delays: { prepareMs: 100 } }),
    { signal: controller.signal }
  );

  assert.equal(evidence.execution.status, 'cancelled');
  assert.equal(evidence.decision.status, 'unknown');
  assert.ok(evidence.unavailable.every(({ reason }) => reason === 'cancelled'));
  assert.ok(adapter.calls.some(({ phase }) => phase === 'cleanup'));
});

test('external cancellation during warmup prevents execution', async () => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 10);

  const { evidence, adapter } = await run(
    makeManifest({ scenario: { warmupRuns: 1 } }),
    makeAdapterScript({ delays: { warmupMs: 100 } }),
    { signal: controller.signal }
  );

  assert.equal(evidence.execution.status, 'cancelled');
  assert.equal(
    adapter.calls.some(({ phase }) => phase === 'execute'),
    false
  );
  assert.ok(adapter.calls.some(({ phase }) => phase === 'cleanup'));
});

test('external cancellation during execution prevents subsequent iterations', async () => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 10);

  const { evidence, adapter } = await run(
    makeManifest({ scenario: { warmupRuns: 0 } }),
    makeAdapterScript({ delays: { executeMs: 100 } }),
    { signal: controller.signal }
  );

  assert.equal(evidence.execution.status, 'cancelled');
  assert.equal(evidence.execution.repetitions.completed, 0);
  assert.equal(
    adapter.calls.some(({ phase, iteration }) => phase === 'execute' && iteration === 2),
    false
  );
  assert.ok(adapter.calls.some(({ phase }) => phase === 'cleanup'));
});

test('cleanup failure remains separate from compatibility evidence', async () => {
  const { evidence } = await run(
    makeManifest({ scenario: { repetitions: 1, warmupRuns: 0 } }),
    makeAdapterScript({
      iterations: [
        {
          measurements: [
            { name: 'timing.initialization.ms', unit: 'ms', value: 900 },
          ],
        },
      ],
      failure: { phase: 'cleanup', message: 'cleanup failed' },
    })
  );

  assert.equal(evidence.execution.status, 'partial');
  assert.equal(evidence.execution.repetitions.completed, 1);
  assert.equal(evidence.decision.status, 'pass');
  assert.ok(evidence.errors.some(({ phase, code }) => phase === 'cleanup' && code === 'cleanup-error'));
});

test('cleanup timeout is bounded and reported', async () => {
  const { evidence } = await run(
    makeManifest({ scenario: { repetitions: 1, warmupRuns: 0 } }),
    makeAdapterScript({
      iterations: [
        {
          measurements: [
            { name: 'timing.initialization.ms', unit: 'ms', value: 900 },
          ],
        },
      ],
      delays: { cleanupMs: 100 },
    }),
    { cleanupTimeoutMs: 10 }
  );

  assert.equal(evidence.execution.status, 'partial');
  assert.ok(evidence.errors.some(({ code }) => code === 'cleanup-timeout'));
});

test('sanitizes and bounds adapter messages before evidence serialization', async () => {
  const manifest = makeManifest({
    scenario: { repetitions: 1, warmupRuns: 0 },
    collect: {
      metrics: ['timing.initialization.ms'],
      checks: ['runtime.requestCompletes'],
      evaluations: [],
    },
    policy: {
      requirements: [
        {
          id: 'request-completes',
          severity: 'required',
          target: { kind: 'check', name: 'runtime.requestCompletes' },
          operator: 'pass',
        },
      ],
    },
  });
  const longMessage = `before\u0000after${'x'.repeat(600)}`;
  const { evidence } = await run(
    manifest,
    makeAdapterScript({
      iterations: [
        {
          checks: [
            {
              name: 'runtime.requestCompletes',
              status: 'pass',
              code: 'completed',
              message: longMessage,
            },
          ],
        },
      ],
    })
  );

  assert.equal(evidence.checks[0].message.includes('\u0000'), false);
  assert.ok(evidence.checks[0].message.length <= 512);
  assert.equal(sanitizeEvidenceMessage(longMessage), evidence.checks[0].message);
});

test('fixture loader verifies digest and passes bytes only through runner context', async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'amaryllis-verify-'));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const fixturePath = path.join(temporary, 'fixture.txt');
  const fixtureBytes = Buffer.from('local sensitive fixture');
  await fs.writeFile(fixturePath, fixtureBytes);

  const manifest = makeManifest({
    scenario: {
      repetitions: 1,
      warmupRuns: 0,
      fixtureRefs: [
        {
          id: 'local-fixture',
          ref: 'fixture.txt',
          digest: {
            algorithm: 'sha256',
            value: sha256Digest(fixtureBytes),
          },
          evidencePolicy: 'exclude-content',
        },
      ],
    },
  });
  const adapter = new FakePlatformAdapter(
    makeAdapterScript({
      iterations: [
        {
          measurements: [
            { name: 'timing.initialization.ms', unit: 'ms', value: 900 },
          ],
        },
      ],
    })
  );
  const evidence = await runVerification({
    manifest,
    validator,
    adapter,
    baseDirectory: temporary,
    idFactory: () => 'fixture-test',
  });

  assert.equal(adapter.calls.find(({ phase }) => phase === 'prepare').fixtureCount, 1);
  assert.equal(JSON.stringify(evidence).includes('local sensitive fixture'), false);
});

test('fixture loader rejects digest mismatch', async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'amaryllis-verify-'));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  await fs.writeFile(path.join(temporary, 'fixture.txt'), 'fixture');

  const manifest = makeManifest({
    scenario: {
      fixtureRefs: [
        {
          id: 'fixture',
          ref: 'fixture.txt',
          digest: { algorithm: 'sha256', value: DIGEST_A },
          evidencePolicy: 'exclude-content',
        },
      ],
    },
  });

  await assert.rejects(
    () => loadDeclaredFixtures(manifest, temporary),
    (error) => error instanceof VerifyRunnerError && error.code === 'fixture.digest-mismatch'
  );
});

test('fixture loader rejects symlink escape outside the manifest directory', async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'amaryllis-verify-'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'amaryllis-verify-outside-'));
  t.after(() => Promise.all([
    fs.rm(temporary, { recursive: true, force: true }),
    fs.rm(outside, { recursive: true, force: true }),
  ]));
  const outsideFile = path.join(outside, 'outside.txt');
  await fs.writeFile(outsideFile, 'outside');
  await fs.symlink(outsideFile, path.join(temporary, 'linked.txt'));

  const manifest = makeManifest({
    scenario: {
      fixtureRefs: [
        {
          id: 'fixture',
          ref: 'linked.txt',
          evidencePolicy: 'exclude-content',
        },
      ],
    },
  });

  await assert.rejects(
    () => loadDeclaredFixtures(manifest, temporary),
    (error) => error instanceof VerifyRunnerError && error.code === 'fixture.path-escape'
  );
});
