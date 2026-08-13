import fs from 'node:fs';
import path from 'node:path';

import type { AnySchema, ErrorObject, ValidateFunction } from 'ajv';
import Ajv2020 from 'ajv/dist/2020';

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface VerifySchemaBundle {
  common: AnySchema;
  manifest: AnySchema;
  evidence: AnySchema;
}

type TargetKind = 'metric' | 'check' | 'evaluation';
type RequirementSeverity = 'required' | 'advisory';
type RequirementOperator =
  | 'lte'
  | 'lt'
  | 'gte'
  | 'gt'
  | 'eq'
  | 'neq'
  | 'present'
  | 'pass';

type RequirementAggregate =
  | 'min'
  | 'max'
  | 'mean'
  | 'p50'
  | 'p95'
  | 'all'
  | 'any'
  | 'last';

interface Requirement {
  id: string;
  severity: RequirementSeverity;
  target: {
    kind: TargetKind;
    name: string;
  };
  operator: RequirementOperator;
  value?: number | string | boolean;
  aggregate?: RequirementAggregate;
  unit?: string;
}

interface VerificationManifest {
  scenario: {
    fixtureRefs?: Array<{
      id: string;
      ref: string;
    }>;
  };
  collect: {
    metrics: string[];
    checks: string[];
    evaluations?: string[];
  };
  policy: {
    requirements: Requirement[];
  };
  output?: {
    path?: string;
  };
}

interface Measurement {
  name: string;
  unit: string;
  samples: Array<{
    iteration: number;
    value: number;
  }>;
  summary: {
    count: number;
    min: number;
    max: number;
    mean: number;
    p50?: number;
    p95?: number;
  };
}

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'unknown';
}

interface EvaluationResult {
  name: string;
  status: 'pass' | 'fail' | 'unknown';
  score?: number;
  unit?: string;
}

interface UnavailableResult {
  kind: TargetKind;
  name: string;
}

interface VerificationEvidence {
  execution: {
    status: 'completed' | 'partial' | 'failed' | 'cancelled';
    repetitions: {
      requested: number;
      completed: number;
    };
  };
  measurements: Measurement[];
  checks: CheckResult[];
  evaluations: EvaluationResult[];
  unavailable: UnavailableResult[];
  policy: {
    requirements: Requirement[];
  };
  decision: {
    status: 'pass' | 'warn' | 'fail' | 'unknown';
    reasons: Array<{
      requirementId?: string;
      code: string;
    }>;
  };
}

const NUMERIC_OPERATORS = new Set<RequirementOperator>([
  'lte',
  'lt',
  'gte',
  'gt',
]);

const NUMERIC_AGGREGATES = new Set<RequirementAggregate>([
  'min',
  'max',
  'mean',
  'p50',
  'p95',
  'last',
]);

const CHECK_STATUSES = new Set(['pass', 'fail', 'unknown']);

const RESERVED_METRIC_UNITS = new Map<string, string>([
  ['timing.initialization.ms', 'ms'],
  ['timing.ttft.ms', 'ms'],
  ['timing.generation.ms', 'ms'],
  ['throughput.tokensPerSecond', 'tokens/s'],
  ['memory.peakRssBytes', 'bytes'],
  ['storage.modelBytes', 'bytes'],
]);

const RFC3339_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function isRfc3339DateTime(value: string): boolean {
  return RFC3339_DATE_TIME.test(value) && Number.isFinite(Date.parse(value));
}

function readJsonSchema(filePath: string): AnySchema {
  const source = fs.readFileSync(filePath, 'utf8');
  const parsed: unknown = JSON.parse(source);

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`expected JSON object schema in ${filePath}`);
  }

  return parsed as AnySchema;
}

export function loadVerifySchemaBundle(directory: string): VerifySchemaBundle {
  const absolute = path.resolve(directory);

  return {
    common: readJsonSchema(path.join(absolute, 'common.schema.json')),
    manifest: readJsonSchema(path.join(absolute, 'manifest.schema.json')),
    evidence: readJsonSchema(path.join(absolute, 'evidence.schema.json')),
  };
}

function schemaIssues(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  return (errors ?? []).map((error) => ({
    code: `schema.${error.keyword}`,
    path: error.instancePath || '/',
    message: error.message ?? 'schema validation failed',
  }));
}

function addIssue(
  issues: ValidationIssue[],
  code: string,
  issuePath: string,
  message: string
): void {
  issues.push({ code, path: issuePath, message });
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

function targetKey(kind: TargetKind, name: string): string {
  return `${kind}:${name}`;
}

function isLocalPathReference(value: string): boolean {
  // Windows drive paths are local despite containing a colon.
  if (/^[A-Za-z]:[\\/]/.test(value)) {
    return true;
  }

  // v1alpha1 references are filesystem paths, not URI fetch instructions.
  return !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function approximatelyEqual(left: number, right: number): boolean {
  const tolerance = Math.max(1e-9, Math.abs(right) * 1e-12);
  return Math.abs(left - right) <= tolerance;
}

function validateRequirementSemantics(
  requirement: Requirement,
  issuePath: string,
  issues: ValidationIssue[]
): void {
  const { kind } = requirement.target;
  const { operator } = requirement;

  if (operator === 'present') {
    if (requirement.value !== undefined) {
      addIssue(
        issues,
        'requirement.present-value',
        issuePath,
        '`present` must not define a comparison value'
      );
    }
    if (requirement.aggregate !== undefined) {
      addIssue(
        issues,
        'requirement.present-aggregate',
        issuePath,
        '`present` must not define an aggregate'
      );
    }
    return;
  }

  if (operator === 'pass') {
    if (kind === 'metric') {
      addIssue(
        issues,
        'requirement.pass-metric',
        issuePath,
        '`pass` is only valid for check or evaluation targets'
      );
    }
    if (requirement.value !== undefined || requirement.aggregate !== undefined) {
      addIssue(
        issues,
        'requirement.pass-comparison',
        issuePath,
        '`pass` must not define value or aggregate comparison data'
      );
    }
    return;
  }

  if (NUMERIC_OPERATORS.has(operator)) {
    if (kind === 'check') {
      addIssue(
        issues,
        'requirement.numeric-check',
        issuePath,
        `numeric operator ${operator} is invalid for check targets`
      );
      return;
    }

    if (!isFiniteNumber(requirement.value)) {
      addIssue(
        issues,
        'requirement.numeric-value',
        issuePath,
        `numeric operator ${operator} requires a finite numeric value`
      );
    }

    if (!requirement.unit) {
      addIssue(
        issues,
        'requirement.numeric-unit',
        issuePath,
        `numeric operator ${operator} requires an explicit unit`
      );
    }

    if (kind === 'metric') {
      if (
        requirement.aggregate === undefined ||
        !NUMERIC_AGGREGATES.has(requirement.aggregate)
      ) {
        addIssue(
          issues,
          'requirement.metric-aggregate',
          issuePath,
          'numeric metric comparisons require min/max/mean/p50/p95/last aggregation'
        );
      }
    } else if (requirement.aggregate !== undefined) {
      addIssue(
        issues,
        'requirement.evaluation-aggregate',
        issuePath,
        'evaluation scores are scalar and must not define an aggregate'
      );
    }
    return;
  }

  if (operator === 'eq' || operator === 'neq') {
    if (requirement.value === undefined) {
      addIssue(
        issues,
        'requirement.equality-value',
        issuePath,
        `${operator} requires a comparison value`
      );
    }

    if (kind === 'metric') {
      if (!isFiniteNumber(requirement.value)) {
        addIssue(
          issues,
          'requirement.metric-equality-value',
          issuePath,
          'metric equality comparisons require a finite numeric value'
        );
      }
      if (
        requirement.aggregate === undefined ||
        !NUMERIC_AGGREGATES.has(requirement.aggregate)
      ) {
        addIssue(
          issues,
          'requirement.metric-aggregate',
          issuePath,
          'metric equality comparisons require min/max/mean/p50/p95/last aggregation'
        );
      }
      if (!requirement.unit) {
        addIssue(
          issues,
          'requirement.metric-unit',
          issuePath,
          'metric equality comparisons require an explicit unit'
        );
      }
    } else if (kind === 'check') {
      if (
        typeof requirement.value !== 'string' ||
        !CHECK_STATUSES.has(requirement.value)
      ) {
        addIssue(
          issues,
          'requirement.check-equality-value',
          issuePath,
          'check equality comparisons must use pass/fail/unknown status values'
        );
      }
      if (requirement.aggregate !== undefined || requirement.unit !== undefined) {
        addIssue(
          issues,
          'requirement.check-comparison-shape',
          issuePath,
          'check equality comparisons must not define aggregate or unit'
        );
      }
    } else if (requirement.aggregate !== undefined) {
      addIssue(
        issues,
        'requirement.evaluation-aggregate',
        issuePath,
        'evaluation equality comparisons must not define an aggregate'
      );
    }
  }
}

function validateManifestSemantics(manifest: VerificationManifest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const requirements = manifest.policy.requirements;

  if (requirements.length === 0) {
    addIssue(
      issues,
      'policy.empty',
      '/policy/requirements',
      'compatibility policy must contain at least one requirement'
    );
  }

  const requirementIds = requirements.map((requirement) => requirement.id);
  if (hasDuplicates(requirementIds)) {
    addIssue(
      issues,
      'policy.duplicate-requirement-id',
      '/policy/requirements',
      'requirement IDs must be unique'
    );
  }

  const requested = {
    metric: new Set(manifest.collect.metrics),
    check: new Set(manifest.collect.checks),
    evaluation: new Set(manifest.collect.evaluations ?? []),
  };

  requirements.forEach((requirement, index) => {
    const requirementPath = `/policy/requirements/${index}`;
    validateRequirementSemantics(requirement, requirementPath, issues);

    if (!requested[requirement.target.kind].has(requirement.target.name)) {
      addIssue(
        issues,
        'policy.undeclared-target',
        `${requirementPath}/target`,
        `requirement target ${requirement.target.kind}:${requirement.target.name} is not declared for collection/evaluation`
      );
    }
  });

  for (const [index, fixture] of (manifest.scenario.fixtureRefs ?? []).entries()) {
    if (!isLocalPathReference(fixture.ref)) {
      addIssue(
        issues,
        'manifest.remote-fixture-ref',
        `/scenario/fixtureRefs/${index}/ref`,
        'v1alpha1 fixture references must be local filesystem paths; URI/network fetch schemes are not supported'
      );
    }
  }

  if (manifest.output?.path && !isLocalPathReference(manifest.output.path)) {
    addIssue(
      issues,
      'manifest.remote-output-path',
      '/output/path',
      'v1alpha1 output path must be a local filesystem path'
    );
  }

  return issues;
}

function validateMeasurementSummary(
  measurement: Measurement,
  index: number,
  completedRepetitions: number,
  issues: ValidationIssue[]
): void {
  const measurementPath = `/measurements/${index}`;
  const values = measurement.samples.map((sample) => sample.value);

  for (const [sampleIndex, sample] of measurement.samples.entries()) {
    if (sample.iteration < 1 || sample.iteration > completedRepetitions) {
      addIssue(
        issues,
        'measurement.iteration-range',
        `${measurementPath}/samples/${sampleIndex}/iteration`,
        `sample iteration must be within completed repetitions 1..${completedRepetitions}`
      );
    }
  }

  if (measurement.summary.count !== values.length) {
    addIssue(
      issues,
      'measurement.summary-count',
      `${measurementPath}/summary/count`,
      'summary count must match the number of retained samples'
    );
  }

  if (values.length === 0) {
    return;
  }

  const expectedMin = Math.min(...values);
  const expectedMax = Math.max(...values);
  const expectedMean = values.reduce((sum, value) => sum + value, 0) / values.length;

  if (!approximatelyEqual(measurement.summary.min, expectedMin)) {
    addIssue(
      issues,
      'measurement.summary-min',
      `${measurementPath}/summary/min`,
      'summary min is not reproducible from retained samples'
    );
  }
  if (!approximatelyEqual(measurement.summary.max, expectedMax)) {
    addIssue(
      issues,
      'measurement.summary-max',
      `${measurementPath}/summary/max`,
      'summary max is not reproducible from retained samples'
    );
  }
  if (!approximatelyEqual(measurement.summary.mean, expectedMean)) {
    addIssue(
      issues,
      'measurement.summary-mean',
      `${measurementPath}/summary/mean`,
      'summary mean is not reproducible from retained samples'
    );
  }

  const reservedUnit = RESERVED_METRIC_UNITS.get(measurement.name);
  if (reservedUnit && measurement.unit !== reservedUnit) {
    addIssue(
      issues,
      'measurement.canonical-unit',
      `${measurementPath}/unit`,
      `reserved metric ${measurement.name} must use canonical unit ${reservedUnit}`
    );
  }
}

function validateEvidenceSemantics(evidence: VerificationEvidence): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const requirements = evidence.policy.requirements;

  if (requirements.length === 0) {
    addIssue(
      issues,
      'policy.empty',
      '/policy/requirements',
      'compatibility policy must contain at least one requirement'
    );
  }

  const requirementIds = requirements.map((requirement) => requirement.id);
  if (hasDuplicates(requirementIds)) {
    addIssue(
      issues,
      'policy.duplicate-requirement-id',
      '/policy/requirements',
      'requirement IDs must be unique'
    );
  }

  if (evidence.execution.repetitions.completed > evidence.execution.repetitions.requested) {
    addIssue(
      issues,
      'execution.repetition-count',
      '/execution/repetitions/completed',
      'completed repetitions must not exceed requested repetitions'
    );
  }

  const measurementNames = evidence.measurements.map((measurement) => measurement.name);
  const checkNames = evidence.checks.map((check) => check.name);
  const evaluationNames = evidence.evaluations.map((evaluation) => evaluation.name);

  if (hasDuplicates(measurementNames)) {
    addIssue(
      issues,
      'evidence.duplicate-measurement',
      '/measurements',
      'measurement names must be unique'
    );
  }
  if (hasDuplicates(checkNames)) {
    addIssue(
      issues,
      'evidence.duplicate-check',
      '/checks',
      'check names must be unique'
    );
  }
  if (hasDuplicates(evaluationNames)) {
    addIssue(
      issues,
      'evidence.duplicate-evaluation',
      '/evaluations',
      'evaluation names must be unique'
    );
  }

  evidence.measurements.forEach((measurement, index) =>
    validateMeasurementSummary(
      measurement,
      index,
      evidence.execution.repetitions.completed,
      issues
    )
  );

  const available = new Set<string>([
    ...measurementNames.map((name) => targetKey('metric', name)),
    ...checkNames.map((name) => targetKey('check', name)),
    ...evaluationNames.map((name) => targetKey('evaluation', name)),
  ]);

  const unavailableKeys = evidence.unavailable.map((entry) =>
    targetKey(entry.kind, entry.name)
  );
  const unavailable = new Set(unavailableKeys);

  if (hasDuplicates(unavailableKeys)) {
    addIssue(
      issues,
      'evidence.duplicate-unavailable',
      '/unavailable',
      'unavailable target entries must be unique'
    );
  }

  for (const key of unavailable) {
    if (available.has(key)) {
      addIssue(
        issues,
        'evidence.available-and-unavailable',
        '/unavailable',
        `target ${key} cannot be both available and unavailable`
      );
    }
  }

  const measurementByName = new Map(
    evidence.measurements.map((measurement) => [measurement.name, measurement])
  );
  const evaluationByName = new Map(
    evidence.evaluations.map((evaluation) => [evaluation.name, evaluation])
  );

  requirements.forEach((requirement, index) => {
    const requirementPath = `/policy/requirements/${index}`;
    validateRequirementSemantics(requirement, requirementPath, issues);

    const key = targetKey(requirement.target.kind, requirement.target.name);
    if (requirement.severity === 'required' && !available.has(key) && !unavailable.has(key)) {
      addIssue(
        issues,
        'policy.required-evidence-missing',
        `${requirementPath}/target`,
        `required target ${key} has neither evidence nor an explicit unavailable entry`
      );
    }

    if (requirement.target.kind === 'metric') {
      const measurement = measurementByName.get(requirement.target.name);
      if (
        measurement &&
        requirement.unit !== undefined &&
        requirement.unit !== measurement.unit
      ) {
        addIssue(
          issues,
          'policy.metric-unit-mismatch',
          `${requirementPath}/unit`,
          `requirement unit ${requirement.unit} does not match evidence unit ${measurement.unit}`
        );
      }

      const reservedUnit = RESERVED_METRIC_UNITS.get(requirement.target.name);
      if (reservedUnit && requirement.unit !== undefined && requirement.unit !== reservedUnit) {
        addIssue(
          issues,
          'policy.canonical-unit',
          `${requirementPath}/unit`,
          `reserved metric ${requirement.target.name} must use canonical unit ${reservedUnit}`
        );
      }
    }

    if (requirement.target.kind === 'evaluation') {
      const evaluation = evaluationByName.get(requirement.target.name);
      if (
        evaluation?.unit !== undefined &&
        requirement.unit !== undefined &&
        evaluation.unit !== requirement.unit
      ) {
        addIssue(
          issues,
          'policy.evaluation-unit-mismatch',
          `${requirementPath}/unit`,
          `requirement unit ${requirement.unit} does not match evaluation unit ${evaluation.unit}`
        );
      }
    }
  });

  const knownRequirementIds = new Set(requirementIds);
  evidence.decision.reasons.forEach((reason, index) => {
    if (reason.requirementId && !knownRequirementIds.has(reason.requirementId)) {
      addIssue(
        issues,
        'decision.unknown-requirement',
        `/decision/reasons/${index}/requirementId`,
        `decision reason references unknown requirement ${reason.requirementId}`
      );
    }
  });

  return issues;
}

export class VerifyValidator {
  private readonly manifestValidator: ValidateFunction;
  private readonly evidenceValidator: ValidateFunction;

  public constructor(bundle: VerifySchemaBundle) {
    const ajv = new Ajv2020({
      allErrors: true,
      allowUnionTypes: true,
      strict: true,
      validateSchema: true,
    });

    ajv.addFormat('date-time', {
      type: 'string',
      validate: isRfc3339DateTime,
    });

    for (const [name, schema] of Object.entries(bundle)) {
      if (!ajv.validateSchema(schema)) {
        const details = schemaIssues(ajv.errors)
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join('; ');
        throw new Error(`invalid Verify schema ${name}: ${details}`);
      }
    }

    ajv.addSchema(bundle.common, 'common.schema.json');
    this.manifestValidator = ajv.compile(bundle.manifest);
    this.evidenceValidator = ajv.compile(bundle.evidence);
  }

  public validateManifest(value: unknown): ValidationResult {
    if (!this.manifestValidator(value)) {
      const issues = schemaIssues(this.manifestValidator.errors);
      return { valid: false, issues };
    }

    const issues = validateManifestSemantics(value as VerificationManifest);
    return { valid: issues.length === 0, issues };
  }

  public validateEvidence(value: unknown): ValidationResult {
    if (!this.evidenceValidator(value)) {
      const issues = schemaIssues(this.evidenceValidator.errors);
      return { valid: false, issues };
    }

    const issues = validateEvidenceSemantics(value as VerificationEvidence);
    return { valid: issues.length === 0, issues };
  }
}
