const STATUS_RANK = {
  pass: 0,
  warn: 1,
  unknown: 2,
  fail: 3,
};

const NUMERIC_OPERATORS = new Set(['lte', 'lt', 'gte', 'gt']);
const NUMERIC_AGGREGATES = new Set(['min', 'max', 'mean', 'p50', 'p95', 'last']);
const RESULT_STATUSES = new Set(['pass', 'fail', 'unknown']);

export class PolicyEvaluationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PolicyEvaluationError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new PolicyEvaluationError(code, message);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function requireNoComparisonMetadata(requirement) {
  if (
    requirement.value !== undefined ||
    requirement.aggregate !== undefined ||
    requirement.unit !== undefined
  ) {
    fail(
      'requirement.unexpected-comparison-metadata',
      `operator ${requirement.operator} on requirement ${requirement.id} must not define value, aggregate, or unit`
    );
  }
}

function requireNumericUnit(requirement) {
  if (typeof requirement.unit !== 'string' || requirement.unit.length === 0) {
    fail(
      'requirement.missing-unit',
      `numeric requirement ${requirement.id} requires an explicit unit`
    );
  }
  return requirement.unit;
}

function requireMatchingUnit(requirement, evidenceUnit) {
  const expected = requireNumericUnit(requirement);
  if (evidenceUnit === undefined) {
    return false;
  }
  if (evidenceUnit !== expected) {
    fail(
      'evidence.unit-mismatch',
      `target ${requirement.target.name} uses unit ${evidenceUnit}; requirement ${requirement.id} expects ${expected}`
    );
  }
  return true;
}

export function percentileR7(values, probability) {
  if (!Array.isArray(values) || values.length === 0) {
    fail('aggregate.empty-samples', 'percentile requires at least one numeric sample');
  }
  if (!isFiniteNumber(probability) || probability < 0 || probability > 1) {
    fail('aggregate.invalid-probability', 'percentile probability must be within 0..1');
  }
  if (!values.every(isFiniteNumber)) {
    fail('aggregate.non-finite-sample', 'metric samples must be finite numbers');
  }

  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 1) {
    return sorted[0];
  }

  // R-7 / linear interpolation: h = (n - 1) * p.
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;

  return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
}

export function aggregateMeasurement(measurement, aggregate) {
  if (!measurement?.samples?.length) {
    fail('aggregate.empty-samples', `metric ${measurement?.name ?? '<unknown>'} has no samples`);
  }

  const values = measurement.samples.map(({ value }) => value);
  if (!values.every(isFiniteNumber)) {
    fail('aggregate.non-finite-sample', `metric ${measurement.name} contains a non-finite sample`);
  }

  switch (aggregate) {
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'mean':
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    case 'p50':
      return percentileR7(values, 0.5);
    case 'p95':
      return percentileR7(values, 0.95);
    case 'last': {
      const last = measurement.samples.reduce((current, candidate) =>
        candidate.iteration > current.iteration ? candidate : current
      );
      return last.value;
    }
    default:
      fail(
        'aggregate.unsupported',
        `aggregate ${String(aggregate)} is not defined for numeric v1alpha1 metrics`
      );
  }
}

function compare(actual, operator, expected) {
  switch (operator) {
    case 'lte':
      return actual <= expected;
    case 'lt':
      return actual < expected;
    case 'gte':
      return actual >= expected;
    case 'gt':
      return actual > expected;
    case 'eq':
      return actual === expected;
    case 'neq':
      return actual !== expected;
    default:
      fail('operator.unsupported', `unsupported comparison operator ${operator}`);
  }
}

function numericRequirementValue(requirement) {
  if (!isFiniteNumber(requirement.value)) {
    fail(
      'requirement.invalid-numeric-value',
      `requirement ${requirement.id} requires a finite numeric comparison value`
    );
  }
  return requirement.value;
}

function evaluateMetric(requirement, measurement) {
  if (requirement.operator === 'present') {
    requireNoComparisonMetadata(requirement);
    return 'satisfied';
  }
  if (requirement.operator === 'pass') {
    requireNoComparisonMetadata(requirement);
    fail('requirement.invalid-metric-operator', '`pass` is invalid for metric requirements');
  }
  if (!NUMERIC_AGGREGATES.has(requirement.aggregate)) {
    fail(
      'requirement.invalid-metric-aggregate',
      `requirement ${requirement.id} has invalid metric aggregate ${String(requirement.aggregate)}`
    );
  }
  if (!requireMatchingUnit(requirement, measurement.unit)) {
    return 'unknown';
  }

  const actual = aggregateMeasurement(measurement, requirement.aggregate);
  const expected = numericRequirementValue(requirement);
  return compare(actual, requirement.operator, expected) ? 'satisfied' : 'violated';
}

function statusOutcome(status, requirement) {
  if (!RESULT_STATUSES.has(status)) {
    fail('evidence.invalid-status', `target ${requirement.target.name} has invalid status ${status}`);
  }
  if (status === 'unknown') {
    return 'unknown';
  }
  return status === 'pass' ? 'satisfied' : 'violated';
}

function evaluateCheck(requirement, check) {
  if (requirement.operator === 'present') {
    requireNoComparisonMetadata(requirement);
    return 'satisfied';
  }
  if (requirement.operator === 'pass') {
    requireNoComparisonMetadata(requirement);
    return statusOutcome(check.status, requirement);
  }
  if (check.status === 'unknown') {
    return 'unknown';
  }
  if (requirement.operator !== 'eq' && requirement.operator !== 'neq') {
    fail(
      'requirement.invalid-check-operator',
      `operator ${requirement.operator} is invalid for check requirements`
    );
  }
  if (requirement.aggregate !== undefined || requirement.unit !== undefined) {
    fail(
      'requirement.invalid-check-metadata',
      `check requirement ${requirement.id} must not define aggregate or unit`
    );
  }
  if (!RESULT_STATUSES.has(requirement.value)) {
    fail(
      'requirement.invalid-check-value',
      `check requirement ${requirement.id} must compare against pass/fail/unknown`
    );
  }
  return compare(check.status, requirement.operator, requirement.value)
    ? 'satisfied'
    : 'violated';
}

function evaluateEvaluation(requirement, evaluation) {
  if (requirement.operator === 'present') {
    requireNoComparisonMetadata(requirement);
    return 'satisfied';
  }
  if (requirement.operator === 'pass') {
    requireNoComparisonMetadata(requirement);
    return statusOutcome(evaluation.status, requirement);
  }
  if (evaluation.status === 'unknown') {
    return 'unknown';
  }

  if (NUMERIC_OPERATORS.has(requirement.operator)) {
    if (requirement.aggregate !== undefined) {
      fail(
        'requirement.invalid-evaluation-aggregate',
        `evaluation requirement ${requirement.id} must not define an aggregate`
      );
    }
    if (!isFiniteNumber(evaluation.score)) {
      return 'unknown';
    }
    if (!requireMatchingUnit(requirement, evaluation.unit)) {
      return 'unknown';
    }
    return compare(
      evaluation.score,
      requirement.operator,
      numericRequirementValue(requirement)
    )
      ? 'satisfied'
      : 'violated';
  }

  if (requirement.operator === 'eq' || requirement.operator === 'neq') {
    if (requirement.aggregate !== undefined) {
      fail(
        'requirement.invalid-evaluation-aggregate',
        `evaluation requirement ${requirement.id} must not define an aggregate`
      );
    }

    if (isFiniteNumber(requirement.value)) {
      if (!isFiniteNumber(evaluation.score)) {
        return 'unknown';
      }
      if (!requireMatchingUnit(requirement, evaluation.unit)) {
        return 'unknown';
      }
      return compare(evaluation.score, requirement.operator, requirement.value)
        ? 'satisfied'
        : 'violated';
    }

    if (typeof requirement.value === 'string' && RESULT_STATUSES.has(requirement.value)) {
      if (requirement.unit !== undefined) {
        fail(
          'requirement.invalid-evaluation-status-unit',
          `status comparison ${requirement.id} must not define a unit`
        );
      }
      return compare(evaluation.status, requirement.operator, requirement.value)
        ? 'satisfied'
        : 'violated';
    }

    fail(
      'requirement.invalid-evaluation-value',
      `evaluation requirement ${requirement.id} must compare a finite score or status`
    );
  }

  fail(
    'requirement.invalid-evaluation-operator',
    `operator ${requirement.operator} is invalid for evaluation requirements`
  );
}

function buildEvidenceIndex(evidence) {
  return {
    metric: new Map(evidence.measurements.map((entry) => [entry.name, entry])),
    check: new Map(evidence.checks.map((entry) => [entry.name, entry])),
    evaluation: new Map(evidence.evaluations.map((entry) => [entry.name, entry])),
    unavailable: new Set(
      evidence.unavailable.map((entry) => `${entry.kind}:${entry.name}`)
    ),
  };
}

function evaluateRequirement(requirement, index) {
  const key = `${requirement.target.kind}:${requirement.target.name}`;
  if (index.unavailable.has(key)) {
    return 'unknown';
  }

  const evidence = index[requirement.target.kind]?.get(requirement.target.name);
  if (!evidence) {
    return 'unknown';
  }

  switch (requirement.target.kind) {
    case 'metric':
      return evaluateMetric(requirement, evidence);
    case 'check':
      return evaluateCheck(requirement, evidence);
    case 'evaluation':
      return evaluateEvaluation(requirement, evidence);
    default:
      fail(
        'requirement.invalid-target-kind',
        `unsupported target kind ${requirement.target.kind}`
      );
  }
}

function contribution(requirement, outcome) {
  if (outcome === 'satisfied') {
    return null;
  }

  if (outcome === 'unknown') {
    return requirement.severity === 'required'
      ? {
          status: 'unknown',
          reason: {
            requirementId: requirement.id,
            code: 'required-evidence-unavailable',
          },
        }
      : {
          status: 'warn',
          reason: {
            requirementId: requirement.id,
            code: 'advisory-evidence-unavailable',
          },
        };
  }

  if (outcome === 'violated') {
    return requirement.severity === 'required'
      ? {
          status: 'fail',
          reason: {
            requirementId: requirement.id,
            code: 'required-violation',
          },
        }
      : {
          status: 'warn',
          reason: {
            requirementId: requirement.id,
            code: 'advisory-violation',
          },
        };
  }

  fail('evaluation.invalid-outcome', `unexpected requirement outcome ${outcome}`);
}

export function evaluateCompatibility(evidence, policy = evidence?.policy) {
  if (!evidence || !policy || !Array.isArray(policy.requirements)) {
    fail('policy.invalid', 'validated evidence and policy requirements are required');
  }
  if (policy.requirements.length === 0) {
    fail('policy.empty', 'compatibility policy must contain at least one requirement');
  }

  const index = buildEvidenceIndex(evidence);
  let status = 'pass';
  const reasons = [];

  for (const requirement of policy.requirements) {
    if (requirement.severity !== 'required' && requirement.severity !== 'advisory') {
      fail(
        'requirement.invalid-severity',
        `requirement ${requirement.id} has invalid severity ${requirement.severity}`
      );
    }

    const result = contribution(requirement, evaluateRequirement(requirement, index));
    if (!result) {
      continue;
    }

    reasons.push(result.reason);
    if (STATUS_RANK[result.status] > STATUS_RANK[status]) {
      status = result.status;
    }
  }

  return { status, reasons };
}
