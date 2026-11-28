import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { FakePlatformAdapter } from './fake-adapter.mjs';
import { runVerification } from './runner.mjs';
import { loadVerifySchemaBundle, VerifyValidator } from './validator.mjs';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolDirectory, '../../../..');
const validator = new VerifyValidator(
  loadVerifySchemaBundle(path.join(repositoryRoot, 'schemas/verify/v1alpha1'))
);

function manifest() {
  return {
    apiVersion: 'amaryllis.dev/verify/v1alpha1',
    kind: 'VerificationManifest',
    metadata: { name: 'atomic-ingestion' },
    subject: {
      application: { id: 'app', version: '1', digest: { algorithm: 'sha256', value: 'a'.repeat(64) } },
      runtime: { package: '@micrantha/react-native-amaryllis', version: '0.1.7', digest: { algorithm: 'sha256', value: 'b'.repeat(64) } },
      model: { id: 'model', version: '1', format: 'test', digest: { algorithm: 'sha256', value: 'c'.repeat(64) } },
    },
    target: { platform: 'android' },
    scenario: { id: 'atomic-ingestion', version: '1', timeoutMs: 1000, repetitions: 1 },
    collect: { metrics: ['timing.initialization.ms'], checks: [], evaluations: [] },
    policy: {
      requirements: [
        {
          id: 'startup',
          severity: 'required',
          target: { kind: 'metric', name: 'timing.initialization.ms' },
          operator: 'lte',
          value: 2000,
          aggregate: 'max',
          unit: 'ms',
        },
      ],
    },
  };
}

function adapter(iterationResult) {
  return new FakePlatformAdapter({
    environment: {
      platform: 'android',
      os: { name: 'Android', version: '15' },
      device: { manufacturer: 'Google', model: 'Pixel 8', architecture: 'arm64-v8a' },
    },
    iterations: [iterationResult],
  });
}

test('mixed valid and undeclared adapter telemetry cannot partially mutate evidence', async () => {
  const fake = adapter({
    measurements: [
      { name: 'timing.initialization.ms', unit: 'ms', value: 900 },
      { name: 'telemetry.unrequested', unit: 'count', value: 1 },
    ],
  });

  const evidence = await runVerification({
    manifest: manifest(),
    validator,
    adapter: fake,
    baseDirectory: repositoryRoot,
    idFactory: () => 'atomic-test',
  });

  assert.equal(evidence.execution.status, 'failed');
  assert.equal(evidence.execution.repetitions.completed, 0);
  assert.deepEqual(evidence.measurements, []);
  assert.equal(evidence.decision.status, 'unknown');
  assert.ok(
    evidence.errors.some(({ code }) => code === 'adapter.undeclared-target')
  );
  assert.ok(fake.calls.some(({ phase }) => phase === 'cleanup'));
});

test('a target cannot be emitted as both available and unavailable in one iteration', async () => {
  const fake = adapter({
    measurements: [
      { name: 'timing.initialization.ms', unit: 'ms', value: 900 },
    ],
    unavailable: [
      {
        kind: 'metric',
        name: 'timing.initialization.ms',
        reason: 'collector-failed',
      },
    ],
  });

  const evidence = await runVerification({
    manifest: manifest(),
    validator,
    adapter: fake,
    baseDirectory: repositoryRoot,
    idFactory: () => 'atomic-test',
  });

  assert.deepEqual(evidence.measurements, []);
  assert.equal(evidence.decision.status, 'unknown');
  assert.ok(
    evidence.errors.some(({ code }) => code === 'adapter.available-and-unavailable')
  );
});
