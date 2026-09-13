import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { FakePlatformAdapter } from './fake-adapter.mjs';
import { runVerification, VerifyRunnerError } from './runner.mjs';
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
    metadata: { name: 'fixture-timeout' },
    subject: {
      application: { id: 'app', version: '1', digest: { algorithm: 'sha256', value: 'a'.repeat(64) } },
      runtime: { package: '@micrantha/react-native-amaryllis', version: '0.1.7', digest: { algorithm: 'sha256', value: 'b'.repeat(64) } },
      model: { id: 'model', version: '1', format: 'test', digest: { algorithm: 'sha256', value: 'c'.repeat(64) } },
    },
    target: { platform: 'android' },
    scenario: {
      id: 'fixture-timeout',
      version: '1',
      timeoutMs: 10,
      repetitions: 1,
    },
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

test('scenario timeout bounds fixture resolution before adapter setup', async () => {
  const adapter = new FakePlatformAdapter({
    environment: {
      platform: 'android',
      os: { name: 'Android', version: '15' },
      device: { manufacturer: 'Google', model: 'Pixel 8', architecture: 'arm64-v8a' },
    },
  });

  await assert.rejects(
    () =>
      runVerification({
        manifest: manifest(),
        validator,
        adapter,
        baseDirectory: repositoryRoot,
        fixtureLoader: () => new Promise(() => {}),
      }),
    (error) =>
      error instanceof VerifyRunnerError &&
      error.code === 'runner.interrupted-before-setup'
  );

  assert.deepEqual(adapter.calls, []);
});
