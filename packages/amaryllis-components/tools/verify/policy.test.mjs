import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  aggregateMeasurement,
  evaluateCompatibility,
  percentileR7,
  PolicyEvaluationError,
} from './policy.mjs';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolDirectory, '../../../..');
const exampleDirectory = path.join(repositoryRoot, 'docs/examples/verify');

function readEvidence(name) {
  return JSON.parse(fs.readFileSync(path.join(exampleDirectory, name), 'utf8'));
}

function clone(value) {
  return structuredClone(value);
}

function requirementById(evidence, id) {
  const requirement = evidence.policy.requirements.find((entry) => entry.id === id);
  assert.ok(requirement, `expected requirement ${id}`);
  return requirement;
}

function assertPolicyError(callback, code) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof PolicyEvaluationError);
    assert.equal(error.code, code);
    return true;
  });
}

const androidEvidence = readEvidence('android.evidence.json');
const iosEvidence = readEvidence('ios.evidence.json');

test('reference Android evidence derives warn for unavailable advisory evidence', () => {
  assert.deepEqual(evaluateCompatibility(androidEvidence), {
    status: 'warn',
    reasons: [
      {
        requirementId: 'thermal-observation',
        code: 'advisory-evidence-unavailable',
      },
    ],
  });
});

test('reference iOS evidence derives unknown for unavailable required evidence', () => {
  assert.deepEqual(evaluateCompatibility(iosEvidence), {
    status: 'unknown',
    reasons: [
      {
        requirementId: 'energy-budget',
        code: 'required-evidence-unavailable',
      },
    ],
  });
});

test('all satisfied required requirements derive pass', () => {
  const evidence = clone(androidEvidence);
  evidence.policy.requirements = evidence.policy.requirements.filter(
    ({ id }) => id !== 'thermal-observation'
  );
  evidence.unavailable = [];

  assert.deepEqual(evaluateCompatibility(evidence), { status: 'pass', reasons: [] });
});

test('advisory threshold violation derives warn', () => {
  const evidence = clone(androidEvidence);
  const startup = requirementById(evidence, 'startup-budget');
  startup.severity = 'advisory';
  startup.value = 1000;
  evidence.policy.requirements = evidence.policy.requirements.filter(
    ({ id }) => id !== 'thermal-observation'
  );
  evidence.unavailable = [];

  assert.deepEqual(evaluateCompatibility(evidence), {
    status: 'warn',
    reasons: [
      {
        requirementId: 'startup-budget',
        code: 'advisory-violation',
      },
    ],
  });
});

test('required threshold violation derives fail', () => {
  const evidence = clone(androidEvidence);
  requirementById(evidence, 'startup-budget').value = 1000;

  const result = evaluateCompatibility(evidence);
  assert.equal(result.status, 'fail');
  assert.ok(
    result.reasons.some(
      ({ requirementId, code }) =>
        requirementId === 'startup-budget' && code === 'required-violation'
    )
  );
});

test('required unavailable evidence derives unknown', () => {
  const evidence = clone(androidEvidence);
  evidence.measurements = evidence.measurements.filter(
    ({ name }) => name !== 'timing.ttft.ms'
  );
  evidence.unavailable.push({
    kind: 'metric',
    name: 'timing.ttft.ms',
    reason: 'collector-failed',
  });

  const result = evaluateCompatibility(evidence);
  assert.equal(result.status, 'unknown');
  assert.ok(
    result.reasons.some(
      ({ requirementId, code }) =>
        requirementId === 'ttft-budget' && code === 'required-evidence-unavailable'
    )
  );
});

test('known required violation outranks required unknown while preserving both reasons', () => {
  const evidence = clone(androidEvidence);
  requirementById(evidence, 'startup-budget').value = 1000;
  evidence.measurements = evidence.measurements.filter(
    ({ name }) => name !== 'timing.ttft.ms'
  );
  evidence.unavailable.push({
    kind: 'metric',
    name: 'timing.ttft.ms',
    reason: 'collector-failed',
  });

  const result = evaluateCompatibility(evidence);
  assert.equal(result.status, 'fail');
  assert.deepEqual(
    new Set(result.reasons.map(({ code }) => code)),
    new Set(['required-violation', 'required-evidence-unavailable', 'advisory-evidence-unavailable'])
  );
});

test('unknown check outcome is unknown rather than a known failure', () => {
  const evidence = clone(androidEvidence);
  const check = evidence.checks.find(({ name }) => name === 'lifecycle.cancelRestart');
  check.status = 'unknown';

  const result = evaluateCompatibility(evidence);
  assert.equal(result.status, 'unknown');
  assert.ok(
    result.reasons.some(
      ({ requirementId, code }) =>
        requirementId === 'cancel-restart' && code === 'required-evidence-unavailable'
    )
  );
});

test('failed required check is a known fail', () => {
  const evidence = clone(androidEvidence);
  const check = evidence.checks.find(({ name }) => name === 'lifecycle.cancelRestart');
  check.status = 'fail';

  const result = evaluateCompatibility(evidence);
  assert.equal(result.status, 'fail');
  assert.ok(
    result.reasons.some(
      ({ requirementId, code }) =>
        requirementId === 'cancel-restart' && code === 'required-violation'
    )
  );
});

test('unknown required evaluation score derives unknown', () => {
  const evidence = clone(androidEvidence);
  const evaluation = evidence.evaluations.find(({ name }) => name === 'quality.chatSmoke');
  evaluation.status = 'unknown';
  delete evaluation.score;

  const result = evaluateCompatibility(evidence);
  assert.equal(result.status, 'unknown');
  assert.ok(
    result.reasons.some(
      ({ requirementId, code }) =>
        requirementId === 'quality-floor' && code === 'required-evidence-unavailable'
    )
  );
});

test('numeric comparison is inclusive at lte and gte equality boundaries', () => {
  const evidence = clone(androidEvidence);
  const initialization = evidence.measurements.find(
    ({ name }) => name === 'timing.initialization.ms'
  );
  const startup = requirementById(evidence, 'startup-budget');
  startup.value = aggregateMeasurement(initialization, 'max');

  const quality = requirementById(evidence, 'quality-floor');
  const evaluation = evidence.evaluations.find(({ name }) => name === 'quality.chatSmoke');
  quality.value = evaluation.score;

  evidence.policy.requirements = evidence.policy.requirements.filter(
    ({ id }) => id !== 'thermal-observation'
  );
  evidence.unavailable = [];

  assert.equal(evaluateCompatibility(evidence).status, 'pass');
});

test('R-7 percentile interpolation is deterministic', () => {
  assert.equal(percentileR7([1, 2, 3], 0.5), 2);
  assert.equal(percentileR7([1, 2, 3], 0.95), 2.9);
  assert.equal(percentileR7([5], 0.95), 5);
});

test('last aggregate uses the highest iteration rather than array order', () => {
  const measurement = {
    name: 'example',
    samples: [
      { iteration: 3, value: 30 },
      { iteration: 1, value: 10 },
      { iteration: 2, value: 20 },
    ],
  };
  assert.equal(aggregateMeasurement(measurement, 'last'), 30);
});

test('non-finite metric samples fail closed', () => {
  const evidence = clone(androidEvidence);
  const measurement = evidence.measurements.find(
    ({ name }) => name === 'timing.initialization.ms'
  );
  measurement.samples[0].value = Number.NaN;

  assertPolicyError(
    () => evaluateCompatibility(evidence),
    'aggregate.non-finite-sample'
  );
});

test('numeric comparator on a check fails closed', () => {
  const evidence = clone(androidEvidence);
  const requirement = requirementById(evidence, 'cancel-restart');
  requirement.operator = 'lte';
  requirement.value = 1;
  requirement.aggregate = 'max';
  requirement.unit = 'count';

  assertPolicyError(
    () => evaluateCompatibility(evidence),
    'requirement.invalid-check-operator'
  );
});

test('present requirements reject comparison metadata', () => {
  const evidence = clone(androidEvidence);
  const requirement = requirementById(evidence, 'thermal-observation');
  requirement.unit = 'state';

  evidence.unavailable = [];
  evidence.measurements.push({
    name: 'thermal.maxState',
    unit: 'state',
    samples: [{ iteration: 1, value: 1 }],
    summary: { count: 1, min: 1, max: 1, mean: 1 },
  });

  assertPolicyError(
    () => evaluateCompatibility(evidence),
    'requirement.unexpected-comparison-metadata'
  );
});

test('pass requirements reject comparison metadata', () => {
  const evidence = clone(androidEvidence);
  const requirement = requirementById(evidence, 'cancel-restart');
  requirement.unit = 'status';

  assertPolicyError(
    () => evaluateCompatibility(evidence),
    'requirement.unexpected-comparison-metadata'
  );
});

test('numeric evaluation comparison requires an explicit policy unit', () => {
  const evidence = clone(androidEvidence);
  const requirement = requirementById(evidence, 'quality-floor');
  delete requirement.unit;

  assertPolicyError(() => evaluateCompatibility(evidence), 'requirement.missing-unit');
});

test('missing evaluation score unit becomes unknown rather than dimensionless pass', () => {
  const evidence = clone(androidEvidence);
  const evaluation = evidence.evaluations.find(({ name }) => name === 'quality.chatSmoke');
  delete evaluation.unit;

  const result = evaluateCompatibility(evidence);
  assert.equal(result.status, 'unknown');
  assert.ok(
    result.reasons.some(
      ({ requirementId, code }) =>
        requirementId === 'quality-floor' && code === 'required-evidence-unavailable'
    )
  );
});

test('mismatched metric units fail closed during direct evaluation', () => {
  const evidence = clone(androidEvidence);
  const measurement = evidence.measurements.find(
    ({ name }) => name === 'timing.initialization.ms'
  );
  measurement.unit = 'seconds';

  assertPolicyError(() => evaluateCompatibility(evidence), 'evidence.unit-mismatch');
});

test('status equality on evaluations rejects units', () => {
  const evidence = clone(androidEvidence);
  const requirement = requirementById(evidence, 'quality-floor');
  requirement.operator = 'eq';
  requirement.value = 'pass';
  requirement.unit = 'ratio';

  assertPolicyError(
    () => evaluateCompatibility(evidence),
    'requirement.invalid-evaluation-status-unit'
  );
});

test('empty policy fails closed', () => {
  const evidence = clone(androidEvidence);
  evidence.policy.requirements = [];
  assertPolicyError(() => evaluateCompatibility(evidence), 'policy.empty');
});

test('evaluation does not mutate evidence or embedded policy', () => {
  const evidence = clone(androidEvidence);
  const before = clone(evidence);
  evaluateCompatibility(evidence);
  assert.deepEqual(evidence, before);
});
