import fs from 'node:fs';
import path from 'node:path';

import {
  loadVerifySchemaBundle,
  VerifyValidator,
  type ValidationResult,
} from '../validator';

const repositoryRoot = path.resolve(__dirname, '../../../..');
const schemaDirectory = path.join(repositoryRoot, 'schemas/verify/v1alpha1');
const exampleDirectory = path.join(repositoryRoot, 'docs/examples/verify');

function readJson(relativePath: string): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(exampleDirectory, relativePath), 'utf8')
  ) as unknown;
}

function cloneRecord(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function nestedRecord(
  record: Record<string, unknown>,
  key: string
): Record<string, unknown> {
  return record[key] as Record<string, unknown>;
}

function nestedRecords(
  record: Record<string, unknown>,
  key: string
): Array<Record<string, unknown>> {
  return record[key] as Array<Record<string, unknown>>;
}

function expectIssue(result: ValidationResult, code: string): void {
  expect(result.valid).toBe(false);
  expect(result.issues).toEqual(
    expect.arrayContaining([expect.objectContaining({ code })])
  );
}

describe('VerifyValidator', () => {
  const validator = new VerifyValidator(loadVerifySchemaBundle(schemaDirectory));
  const androidManifest = readJson('android.manifest.json');
  const androidEvidence = readJson('android.evidence.json');
  const iosManifest = readJson('ios.manifest.json');
  const iosEvidence = readJson('ios.evidence.json');

  test('accepts the committed Android and iOS reference artifacts', () => {
    expect(validator.validateManifest(androidManifest)).toEqual({
      valid: true,
      issues: [],
    });
    expect(validator.validateEvidence(androidEvidence)).toEqual({
      valid: true,
      issues: [],
    });
    expect(validator.validateManifest(iosManifest)).toEqual({
      valid: true,
      issues: [],
    });
    expect(validator.validateEvidence(iosEvidence)).toEqual({
      valid: true,
      issues: [],
    });
  });

  test.each([
    'prompt',
    'generatedOutput',
    'retrievedContext',
    'embeddings',
    'rawLogs',
    'telemetry',
    'accessToken',
  ])('rejects top-level privacy-sensitive field %s', (field) => {
    const evidence = cloneRecord(androidEvidence);
    evidence[field] = 'sensitive';

    expectIssue(validator.validateEvidence(evidence), 'schema.additionalProperties');
  });

  test.each(['serialNumber', 'imei', 'advertisingId'])(
    'rejects persistent device identifier %s',
    (field) => {
      const evidence = cloneRecord(androidEvidence);
      const environment = nestedRecord(evidence, 'environment');
      const device = nestedRecord(environment, 'device');
      device[field] = 'persistent-id';

      expectIssue(
        validator.validateEvidence(evidence),
        'schema.additionalProperties'
      );
    }
  );

  test('rejects an oversized diagnostic message', () => {
    const evidence = cloneRecord(androidEvidence);
    nestedRecords(evidence, 'unavailable')[0].message = 'x'.repeat(513);

    expectIssue(validator.validateEvidence(evidence), 'schema.maxLength');
  });

  test.each([
    'https://example.invalid/fixture.json',
    's3:bucket/fixture.json',
    'file:/tmp/fixture.json',
  ])('rejects URI fixture reference %s', (ref) => {
    const manifest = cloneRecord(androidManifest);
    const scenario = nestedRecord(manifest, 'scenario');
    const fixture = nestedRecords(scenario, 'fixtureRefs')[0];
    fixture.ref = ref;

    expectIssue(
      validator.validateManifest(manifest),
      'manifest.remote-fixture-ref'
    );
  });

  test('allows a Windows local fixture path', () => {
    const manifest = cloneRecord(androidManifest);
    const scenario = nestedRecord(manifest, 'scenario');
    const fixture = nestedRecords(scenario, 'fixtureRefs')[0];
    fixture.ref = 'C:\\fixtures\\chat-basic.json';

    expect(validator.validateManifest(manifest)).toEqual({
      valid: true,
      issues: [],
    });
  });

  test('rejects an empty manifest compatibility policy at schema level', () => {
    const manifest = cloneRecord(androidManifest);
    const policy = nestedRecord(manifest, 'policy');
    policy.requirements = [];

    expectIssue(validator.validateManifest(manifest), 'schema.minItems');
  });

  test('rejects an empty evidence compatibility policy semantically', () => {
    const evidence = cloneRecord(androidEvidence);
    const policy = nestedRecord(evidence, 'policy');
    policy.requirements = [];

    expectIssue(validator.validateEvidence(evidence), 'policy.empty');
  });

  test('rejects duplicate requirement identifiers', () => {
    const manifest = cloneRecord(androidManifest);
    const policy = nestedRecord(manifest, 'policy');
    const requirements = nestedRecords(policy, 'requirements');
    requirements[1].id = requirements[0].id;

    expectIssue(
      validator.validateManifest(manifest),
      'policy.duplicate-requirement-id'
    );
  });

  test('rejects a requirement for an undeclared collection target', () => {
    const manifest = cloneRecord(androidManifest);
    const policy = nestedRecord(manifest, 'policy');
    const requirements = nestedRecords(policy, 'requirements');
    const target = nestedRecord(requirements[0], 'target');
    target.name = 'timing.notRequested.ms';

    expectIssue(validator.validateManifest(manifest), 'policy.undeclared-target');
  });

  test('rejects numeric comparison against a check target', () => {
    const manifest = cloneRecord(androidManifest);
    const policy = nestedRecord(manifest, 'policy');
    const requirements = nestedRecords(policy, 'requirements');
    const checkRequirement = requirements.find(
      (requirement) => requirement.id === 'cancel-restart'
    );
    expect(checkRequirement).toBeDefined();
    if (!checkRequirement) {
      return;
    }
    checkRequirement.operator = 'lte';
    checkRequirement.value = 1;
    checkRequirement.unit = 'count';

    expectIssue(validator.validateManifest(manifest), 'requirement.numeric-check');
  });

  test('rejects available evidence also marked unavailable', () => {
    const evidence = cloneRecord(androidEvidence);
    const unavailable = nestedRecords(evidence, 'unavailable')[0];
    unavailable.name = 'timing.ttft.ms';

    expectIssue(
      validator.validateEvidence(evidence),
      'evidence.available-and-unavailable'
    );
  });

  test('rejects a missing required evidence target without unavailable record', () => {
    const evidence = cloneRecord(androidEvidence);
    const measurements = nestedRecords(evidence, 'measurements');
    evidence.measurements = measurements.filter(
      (measurement) => measurement.name !== 'timing.ttft.ms'
    );

    expectIssue(
      validator.validateEvidence(evidence),
      'policy.required-evidence-missing'
    );
  });

  test('rejects completed repetitions greater than requested', () => {
    const evidence = cloneRecord(androidEvidence);
    const execution = nestedRecord(evidence, 'execution');
    const repetitions = nestedRecord(execution, 'repetitions');
    repetitions.completed = 4;

    expectIssue(
      validator.validateEvidence(evidence),
      'execution.repetition-count'
    );
  });

  test('rejects samples outside the completed repetition range', () => {
    const evidence = cloneRecord(androidEvidence);
    const measurement = nestedRecords(evidence, 'measurements')[0];
    const samples = nestedRecords(measurement, 'samples');
    samples[0].iteration = 4;

    expectIssue(
      validator.validateEvidence(evidence),
      'measurement.iteration-range'
    );
  });

  test('rejects inconsistent summary count and mean', () => {
    const evidence = cloneRecord(androidEvidence);
    const measurement = nestedRecords(evidence, 'measurements')[0];
    const summary = nestedRecord(measurement, 'summary');
    summary.count = 2;
    summary.mean = 999999;

    const result = validator.validateEvidence(evidence);
    expectIssue(result, 'measurement.summary-count');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'measurement.summary-mean' }),
      ])
    );
  });

  test('rejects non-canonical units for reserved metrics', () => {
    const evidence = cloneRecord(androidEvidence);
    const measurement = nestedRecords(evidence, 'measurements')[0];
    measurement.unit = 'seconds';

    expectIssue(
      validator.validateEvidence(evidence),
      'measurement.canonical-unit'
    );
  });

  test('rejects requirement and evidence unit mismatch', () => {
    const evidence = cloneRecord(androidEvidence);
    const policy = nestedRecord(evidence, 'policy');
    const requirements = nestedRecords(policy, 'requirements');
    const startup = requirements.find(
      (requirement) => requirement.id === 'startup-budget'
    );
    expect(startup).toBeDefined();
    if (!startup) {
      return;
    }
    startup.unit = 'seconds';

    expectIssue(
      validator.validateEvidence(evidence),
      'policy.metric-unit-mismatch'
    );
  });

  test('rejects decision reason references to unknown requirements', () => {
    const evidence = cloneRecord(androidEvidence);
    const decision = nestedRecord(evidence, 'decision');
    const reasons = nestedRecords(decision, 'reasons');
    reasons[0].requirementId = 'does-not-exist';

    expectIssue(
      validator.validateEvidence(evidence),
      'decision.unknown-requirement'
    );
  });
});
