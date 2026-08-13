import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadVerifySchemaBundle, VerifyValidator } from './validator.mjs';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolDirectory, '../../../..');
const schemaDirectory = path.join(repositoryRoot, 'schemas/verify/v1alpha1');
const exampleDirectory = path.join(repositoryRoot, 'docs/examples/verify');
const validator = new VerifyValidator(loadVerifySchemaBundle(schemaDirectory));

function readExample(name) {
  return JSON.parse(fs.readFileSync(path.join(exampleDirectory, name), 'utf8'));
}

function clone(value) {
  return structuredClone(value);
}

function assertIssue(result, code) {
  assert.equal(result.valid, false, `expected validation failure containing ${code}`);
  assert.ok(
    result.issues.some((issue) => issue.code === code),
    `expected issue ${code}; got ${JSON.stringify(result.issues)}`
  );
}

const androidManifest = readExample('android.manifest.json');
const androidEvidence = readExample('android.evidence.json');
const iosManifest = readExample('ios.manifest.json');
const iosEvidence = readExample('ios.evidence.json');

test('committed Android and iOS examples validate', () => {
  assert.deepEqual(validator.validateManifest(androidManifest), { valid: true, issues: [] });
  assert.deepEqual(validator.validateEvidence(androidEvidence), { valid: true, issues: [] });
  assert.deepEqual(validator.validateManifest(iosManifest), { valid: true, issues: [] });
  assert.deepEqual(validator.validateEvidence(iosEvidence), { valid: true, issues: [] });
});

for (const field of [
  'prompt',
  'generatedOutput',
  'retrievedContext',
  'embeddings',
  'rawLogs',
  'telemetry',
  'accessToken',
]) {
  test(`rejects privacy-sensitive top-level field ${field}`, () => {
    const evidence = clone(androidEvidence);
    evidence[field] = 'sensitive';
    assertIssue(validator.validateEvidence(evidence), 'schema.additionalProperties');
  });
}

for (const field of ['serialNumber', 'imei', 'advertisingId']) {
  test(`rejects persistent device identifier ${field}`, () => {
    const evidence = clone(androidEvidence);
    evidence.environment.device[field] = 'persistent-id';
    assertIssue(validator.validateEvidence(evidence), 'schema.additionalProperties');
  });
}

test('rejects oversized diagnostic messages', () => {
  const evidence = clone(androidEvidence);
  evidence.unavailable[0].message = 'x'.repeat(513);
  assertIssue(validator.validateEvidence(evidence), 'schema.maxLength');
});

for (const ref of [
  'https://example.invalid/fixture.json',
  's3:bucket/fixture.json',
  'file:/tmp/fixture.json',
]) {
  test(`rejects URI fixture reference ${ref}`, () => {
    const manifest = clone(androidManifest);
    manifest.scenario.fixtureRefs[0].ref = ref;
    assertIssue(validator.validateManifest(manifest), 'manifest.remote-fixture-ref');
  });
}

test('allows Windows local fixture paths', () => {
  const manifest = clone(androidManifest);
  manifest.scenario.fixtureRefs[0].ref = 'C:\\fixtures\\chat-basic.json';
  assert.deepEqual(validator.validateManifest(manifest), { valid: true, issues: [] });
});

test('rejects remote output paths', () => {
  const manifest = clone(androidManifest);
  manifest.output.path = 'https://example.invalid/evidence.json';
  assertIssue(validator.validateManifest(manifest), 'manifest.remote-output-path');
});

test('rejects an empty manifest compatibility policy', () => {
  const manifest = clone(androidManifest);
  manifest.policy.requirements = [];
  assertIssue(validator.validateManifest(manifest), 'schema.minItems');
});

test('rejects an empty evidence compatibility policy', () => {
  const evidence = clone(androidEvidence);
  evidence.policy.requirements = [];
  assertIssue(validator.validateEvidence(evidence), 'policy.empty');
});

test('rejects duplicate requirement identifiers', () => {
  const manifest = clone(androidManifest);
  manifest.policy.requirements[1].id = manifest.policy.requirements[0].id;
  assertIssue(validator.validateManifest(manifest), 'policy.duplicate-requirement-id');
});

test('rejects requirements for undeclared collection targets', () => {
  const manifest = clone(androidManifest);
  manifest.policy.requirements[0].target.name = 'timing.notRequested.ms';
  assertIssue(validator.validateManifest(manifest), 'policy.undeclared-target');
});

test('rejects numeric comparisons against check targets', () => {
  const manifest = clone(androidManifest);
  const requirement = manifest.policy.requirements.find(({ id }) => id === 'cancel-restart');
  requirement.operator = 'lte';
  requirement.value = 1;
  requirement.unit = 'count';
  assertIssue(validator.validateManifest(manifest), 'requirement.numeric-check');
});

test('rejects available evidence also marked unavailable', () => {
  const evidence = clone(androidEvidence);
  evidence.unavailable[0].name = 'timing.ttft.ms';
  assertIssue(validator.validateEvidence(evidence), 'evidence.available-and-unavailable');
});

test('rejects duplicate unavailable entries', () => {
  const evidence = clone(androidEvidence);
  evidence.unavailable.push(clone(evidence.unavailable[0]));
  assertIssue(validator.validateEvidence(evidence), 'evidence.duplicate-unavailable');
});

test('rejects required targets with neither evidence nor explicit unavailable state', () => {
  const evidence = clone(androidEvidence);
  evidence.measurements = evidence.measurements.filter(
    ({ name }) => name !== 'timing.ttft.ms'
  );
  assertIssue(validator.validateEvidence(evidence), 'policy.required-evidence-missing');
});

test('allows required evidence to be explicitly unavailable', () => {
  const evidence = clone(iosEvidence);
  assert.deepEqual(validator.validateEvidence(evidence), { valid: true, issues: [] });
});

test('rejects completed repetitions greater than requested', () => {
  const evidence = clone(androidEvidence);
  evidence.execution.repetitions.completed = 4;
  assertIssue(validator.validateEvidence(evidence), 'execution.repetition-count');
});

test('rejects samples outside the completed repetition range', () => {
  const evidence = clone(androidEvidence);
  evidence.measurements[0].samples[0].iteration = 4;
  assertIssue(validator.validateEvidence(evidence), 'measurement.iteration-range');
});

test('rejects duplicate sample iterations for one metric', () => {
  const evidence = clone(androidEvidence);
  evidence.measurements[0].samples[1].iteration = 1;
  assertIssue(validator.validateEvidence(evidence), 'measurement.duplicate-iteration');
});

test('rejects inconsistent summary count and mean', () => {
  const evidence = clone(androidEvidence);
  evidence.measurements[0].summary.count = 2;
  evidence.measurements[0].summary.mean = 999999;
  const result = validator.validateEvidence(evidence);
  assertIssue(result, 'measurement.summary-count');
  assert.ok(result.issues.some(({ code }) => code === 'measurement.summary-mean'));
});

test('rejects non-canonical units for reserved metrics', () => {
  const evidence = clone(androidEvidence);
  evidence.measurements[0].unit = 'seconds';
  assertIssue(validator.validateEvidence(evidence), 'measurement.canonical-unit');
});

test('rejects requirement/evidence metric unit mismatch', () => {
  const evidence = clone(androidEvidence);
  const requirement = evidence.policy.requirements.find(({ id }) => id === 'startup-budget');
  requirement.unit = 'seconds';
  assertIssue(validator.validateEvidence(evidence), 'policy.metric-unit-mismatch');
});

test('rejects decision reasons referencing unknown requirements', () => {
  const evidence = clone(androidEvidence);
  evidence.decision.reasons[0].requirementId = 'does-not-exist';
  assertIssue(validator.validateEvidence(evidence), 'decision.unknown-requirement');
});
