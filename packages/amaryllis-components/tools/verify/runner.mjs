import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { evaluateCompatibility, percentileR7 } from './policy.mjs';
import { isLocalPathReference } from './validator.mjs';

const DEFAULT_MAX_FIXTURE_BYTES = 32 * 1024 * 1024;
const DEFAULT_CLEANUP_TIMEOUT_MS = 5000;
const MAX_MESSAGE_LENGTH = 512;

const ALLOWED_ITERATION_RESULT_KEYS = new Set([
  'measurements',
  'checks',
  'evaluations',
  'unavailable',
  'errors',
]);
const ALLOWED_MEASUREMENT_KEYS = new Set(['name', 'unit', 'value']);
const ALLOWED_CHECK_KEYS = new Set(['name', 'status', 'code', 'message']);
const ALLOWED_EVALUATION_KEYS = new Set(['name', 'status', 'score', 'unit', 'code']);
const ALLOWED_UNAVAILABLE_KEYS = new Set(['kind', 'name', 'reason', 'message']);
const ALLOWED_ERROR_KEYS = new Set(['phase', 'code', 'message']);

export class VerifyRunnerError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'VerifyRunnerError';
    this.code = code;
  }
}

class RunInterruptedError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'RunInterruptedError';
    this.kind = kind;
  }
}

function runnerError(code, message, cause) {
  throw new VerifyRunnerError(code, message, cause ? { cause } : undefined);
}

function assertKnownKeys(value, allowed, context) {
  for (const key of Object.keys(value ?? {})) {
    if (!allowed.has(key)) {
      runnerError('adapter.unknown-field', `${context} contains undeclared field ${key}`);
    }
  }
}

function assertFiniteNumber(value, context) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    runnerError('adapter.non-finite-number', `${context} must be a finite number`);
  }
}

export function sanitizeEvidenceMessage(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .slice(0, MAX_MESSAGE_LENGTH);
}

function canonicalizeJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      runnerError('canonicalization.non-finite-number', 'JSON canonicalization requires finite numbers');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalizeJson(value[key])}`)
      .join(',')}}`;
  }

  runnerError(
    'canonicalization.unsupported-value',
    `cannot canonicalize JSON value of type ${typeof value}`
  );
}

export function sha256Digest(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export function digestJson(value) {
  return sha256Digest(canonicalizeJson(value));
}

function isPathWithin(base, candidate) {
  const relative = path.relative(base, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isUncPath(value) {
  return value.startsWith('\\\\') || value.startsWith('//');
}

export async function loadDeclaredFixtures(
  manifest,
  baseDirectory,
  {
    maxFixtureBytes = DEFAULT_MAX_FIXTURE_BYTES,
    allowAbsoluteFixturePaths = false,
  } = {}
) {
  const fixtures = new Map();
  const declarations = manifest.scenario.fixtureRefs ?? [];
  const realBase = await fs.realpath(path.resolve(baseDirectory));

  for (const fixture of declarations) {
    if (fixtures.has(fixture.id)) {
      runnerError('fixture.duplicate-id', `fixture ID ${fixture.id} is duplicated`);
    }
    if (!isLocalPathReference(fixture.ref) || isUncPath(fixture.ref)) {
      runnerError('fixture.non-local-reference', `fixture ${fixture.id} must use a local filesystem path`);
    }

    const absoluteReference = path.isAbsolute(fixture.ref);
    if (absoluteReference && !allowAbsoluteFixturePaths) {
      runnerError(
        'fixture.absolute-path-disabled',
        `fixture ${fixture.id} uses an absolute path but absolute fixture paths are disabled`
      );
    }

    const candidate = absoluteReference
      ? path.resolve(fixture.ref)
      : path.resolve(realBase, fixture.ref);
    const realCandidate = await fs.realpath(candidate).catch((error) => {
      runnerError('fixture.not-found', `fixture ${fixture.id} could not be resolved`, error);
    });

    if (!absoluteReference && !isPathWithin(realBase, realCandidate)) {
      runnerError(
        'fixture.path-escape',
        `fixture ${fixture.id} resolves outside the manifest directory`
      );
    }

    const stat = await fs.stat(realCandidate);
    if (!stat.isFile()) {
      runnerError('fixture.not-file', `fixture ${fixture.id} is not a regular file`);
    }
    if (stat.size > maxFixtureBytes) {
      runnerError(
        'fixture.too-large',
        `fixture ${fixture.id} exceeds the ${maxFixtureBytes} byte limit`
      );
    }

    const bytes = await fs.readFile(realCandidate);
    const digest = sha256Digest(bytes);
    if (fixture.digest && digest.toLowerCase() !== fixture.digest.value.toLowerCase()) {
      runnerError('fixture.digest-mismatch', `fixture ${fixture.id} digest does not match the manifest`);
    }

    fixtures.set(fixture.id, {
      id: fixture.id,
      path: realCandidate,
      bytes,
      digest: {
        algorithm: 'sha256',
        value: digest,
      },
    });
  }

  return fixtures;
}

function createRunSignal(externalSignal, timeoutMs) {
  const controller = new AbortController();
  let interruption = null;

  const abort = (kind, message) => {
    if (!controller.signal.aborted) {
      interruption = { kind, message };
      controller.abort(interruption);
    }
  };

  const externalAbort = () => abort('cancelled', 'verification cancelled');
  if (externalSignal?.aborted) {
    externalAbort();
  } else {
    externalSignal?.addEventListener('abort', externalAbort, { once: true });
  }

  const timer = setTimeout(() => abort('timeout', 'verification timed out'), timeoutMs);

  return {
    signal: controller.signal,
    interruption: () => interruption,
    dispose() {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', externalAbort);
    },
  };
}

async function runAbortable(operation, signal) {
  if (signal.aborted) {
    const reason = signal.reason ?? { kind: 'cancelled', message: 'verification cancelled' };
    throw new RunInterruptedError(reason.kind ?? 'cancelled', reason.message ?? 'verification cancelled');
  }

  let abortHandler;
  const aborted = new Promise((_, reject) => {
    abortHandler = () => {
      const reason = signal.reason ?? { kind: 'cancelled', message: 'verification cancelled' };
      reject(new RunInterruptedError(reason.kind ?? 'cancelled', reason.message ?? 'verification cancelled'));
    };
    signal.addEventListener('abort', abortHandler, { once: true });
  });

  try {
    return await Promise.race([Promise.resolve().then(operation), aborted]);
  } finally {
    signal.removeEventListener('abort', abortHandler);
  }
}

async function runCleanup(adapter, context, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort({ kind: 'cleanup-timeout', message: 'cleanup timed out' }),
    timeoutMs
  );

  try {
    await runAbortable(() => adapter.cleanup(context, controller.signal), controller.signal);
    return null;
  } catch (error) {
    return error;
  } finally {
    clearTimeout(timer);
  }
}

function validateTarget(manifest, environment) {
  if (environment.platform !== manifest.target.platform) {
    runnerError(
      'target.platform-mismatch',
      `manifest targets ${manifest.target.platform} but adapter reported ${environment.platform}`
    );
  }

  const actualCapabilities = new Set(environment.device?.capabilities ?? []);
  for (const capability of manifest.target.requiredCapabilities ?? []) {
    if (!actualCapabilities.has(capability)) {
      runnerError(
        'target.capability-missing',
        `target requires capability ${capability}, but the adapter did not report it`
      );
    }
  }
}

function requestedTargets(manifest) {
  return {
    metric: new Set(manifest.collect.metrics),
    check: new Set(manifest.collect.checks),
    evaluation: new Set(manifest.collect.evaluations ?? []),
  };
}

function assertRequestedTarget(requested, kind, name) {
  if (!requested[kind]?.has(name)) {
    runnerError(
      'adapter.undeclared-target',
      `adapter attempted to emit undeclared ${kind} ${name}`
    );
  }
}

function recordIterationResult(state, result, iteration) {
  assertKnownKeys(result, ALLOWED_ITERATION_RESULT_KEYS, `iteration ${iteration} result`);

  for (const measurement of result.measurements ?? []) {
    assertKnownKeys(measurement, ALLOWED_MEASUREMENT_KEYS, `measurement ${measurement.name ?? '<unknown>'}`);
    assertRequestedTarget(state.requested, 'metric', measurement.name);
    assertFiniteNumber(measurement.value, `measurement ${measurement.name}`);
    if (typeof measurement.unit !== 'string' || measurement.unit.length === 0) {
      runnerError('adapter.metric-unit-missing', `measurement ${measurement.name} must define a unit`);
    }

    const existing = state.measurements.get(measurement.name);
    if (existing && existing.unit !== measurement.unit) {
      runnerError(
        'adapter.metric-unit-drift',
        `measurement ${measurement.name} changed unit from ${existing.unit} to ${measurement.unit}`
      );
    }
    const entry = existing ?? { name: measurement.name, unit: measurement.unit, samples: [] };
    if (entry.samples.some((sample) => sample.iteration === iteration)) {
      runnerError(
        'adapter.duplicate-metric-sample',
        `measurement ${measurement.name} emitted more than once for iteration ${iteration}`
      );
    }
    entry.samples.push({ iteration, value: measurement.value });
    state.measurements.set(measurement.name, entry);
  }

  for (const check of result.checks ?? []) {
    assertKnownKeys(check, ALLOWED_CHECK_KEYS, `check ${check.name ?? '<unknown>'}`);
    assertRequestedTarget(state.requested, 'check', check.name);
    if (state.checks.has(check.name)) {
      runnerError('adapter.duplicate-check', `check ${check.name} is run-scoped and may be emitted once`);
    }
    state.checks.set(check.name, {
      name: check.name,
      status: check.status,
      ...(check.code ? { code: check.code } : {}),
      ...(sanitizeEvidenceMessage(check.message) !== undefined
        ? { message: sanitizeEvidenceMessage(check.message) }
        : {}),
    });
  }

  for (const evaluation of result.evaluations ?? []) {
    assertKnownKeys(
      evaluation,
      ALLOWED_EVALUATION_KEYS,
      `evaluation ${evaluation.name ?? '<unknown>'}`
    );
    assertRequestedTarget(state.requested, 'evaluation', evaluation.name);
    if (state.evaluations.has(evaluation.name)) {
      runnerError(
        'adapter.duplicate-evaluation',
        `evaluation ${evaluation.name} is run-scoped and may be emitted once`
      );
    }
    if (evaluation.score !== undefined) {
      assertFiniteNumber(evaluation.score, `evaluation ${evaluation.name} score`);
    }
    state.evaluations.set(evaluation.name, {
      name: evaluation.name,
      status: evaluation.status,
      ...(evaluation.score !== undefined ? { score: evaluation.score } : {}),
      ...(evaluation.unit ? { unit: evaluation.unit } : {}),
      ...(evaluation.code ? { code: evaluation.code } : {}),
    });
  }

  for (const unavailable of result.unavailable ?? []) {
    assertKnownKeys(
      unavailable,
      ALLOWED_UNAVAILABLE_KEYS,
      `unavailable ${unavailable.name ?? '<unknown>'}`
    );
    assertRequestedTarget(state.requested, unavailable.kind, unavailable.name);
    const key = `${unavailable.kind}:${unavailable.name}`;
    if (state.unavailable.has(key)) {
      runnerError('adapter.duplicate-unavailable', `target ${key} was marked unavailable more than once`);
    }
    state.unavailable.set(key, {
      kind: unavailable.kind,
      name: unavailable.name,
      reason: unavailable.reason,
      ...(sanitizeEvidenceMessage(unavailable.message) !== undefined
        ? { message: sanitizeEvidenceMessage(unavailable.message) }
        : {}),
    });
  }

  for (const error of result.errors ?? []) {
    assertKnownKeys(error, ALLOWED_ERROR_KEYS, `adapter error ${error.code ?? '<unknown>'}`);
    state.errors.push({
      phase: error.phase,
      code: error.code,
      ...(sanitizeEvidenceMessage(error.message) !== undefined
        ? { message: sanitizeEvidenceMessage(error.message) }
        : {}),
    });
  }
}

function summarizeMeasurement(measurement) {
  const values = measurement.samples.map(({ value }) => value);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    name: measurement.name,
    unit: measurement.unit,
    samples: measurement.samples,
    summary: {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      mean,
      p50: percentileR7(values, 0.5),
      p95: percentileR7(values, 0.95),
    },
  };
}

function hasAvailableTarget(state, kind, name) {
  if (kind === 'metric') return state.measurements.has(name);
  if (kind === 'check') return state.checks.has(name);
  return state.evaluations.has(name);
}

function fillMissingTargets(state, reason) {
  for (const kind of ['metric', 'check', 'evaluation']) {
    for (const name of state.requested[kind]) {
      const key = `${kind}:${name}`;
      if (!hasAvailableTarget(state, kind, name) && !state.unavailable.has(key)) {
        state.unavailable.set(key, { kind, name, reason });
      }
    }
  }
}

function executionStatus(interruption, failed, completed, requested) {
  if (interruption?.kind === 'cancelled') return 'cancelled';
  if (interruption?.kind === 'timeout') return 'failed';
  if (failed) return completed > 0 ? 'partial' : 'failed';
  return completed === requested ? 'completed' : 'partial';
}

function isoTime(milliseconds) {
  return new Date(milliseconds).toISOString();
}

function validationMessage(result) {
  return result.issues.map((issue) => `${issue.path} ${issue.code}: ${issue.message}`).join('; ');
}

export async function runVerification({
  manifest,
  validator,
  adapter,
  baseDirectory = process.cwd(),
  signal,
  clock = () => Date.now(),
  idFactory = () => crypto.randomUUID(),
  runnerInfo = { name: 'amaryllis-verify', version: '0.1.0-alpha.1' },
  cleanupTimeoutMs = DEFAULT_CLEANUP_TIMEOUT_MS,
  maxFixtureBytes = DEFAULT_MAX_FIXTURE_BYTES,
  allowAbsoluteFixturePaths = false,
  fixtureLoader = loadDeclaredFixtures,
} = {}) {
  if (!validator || !adapter || !manifest) {
    runnerError('runner.invalid-arguments', 'manifest, validator, and adapter are required');
  }

  const manifestValidation = validator.validateManifest(manifest);
  if (!manifestValidation.valid) {
    runnerError('invalid-manifest', validationMessage(manifestValidation));
  }

  const startMs = clock();
  const runSignal = createRunSignal(signal, manifest.scenario.timeoutMs);
  let capabilities;
  let fixtures;

  try {
    fixtures = await runAbortable(
      () =>
        fixtureLoader(manifest, baseDirectory, {
          maxFixtureBytes,
          allowAbsoluteFixturePaths,
        }),
      runSignal.signal
    );
    capabilities = await runAbortable(() => adapter.capabilities(runSignal.signal), runSignal.signal);
    validateTarget(manifest, capabilities.environment);
  } catch (error) {
    runSignal.dispose();
    if (error instanceof VerifyRunnerError) throw error;
    if (error instanceof RunInterruptedError) {
      runnerError('runner.interrupted-before-setup', error.message, error);
    }
    runnerError('runner.capabilities-failed', 'failed to prepare verification target', error);
  }

  const state = {
    requested: requestedTargets(manifest),
    measurements: new Map(),
    checks: new Map(),
    evaluations: new Map(),
    unavailable: new Map(),
    errors: [],
  };
  const context = {
    manifest,
    fixtures,
    environment: capabilities.environment,
  };

  let completed = 0;
  let failed = false;
  let interruption = null;

  const executePhase = async (phase, operation) => {
    try {
      return await runAbortable(operation, runSignal.signal);
    } catch (error) {
      if (error instanceof RunInterruptedError) {
        interruption = { kind: error.kind, message: error.message };
      } else {
        failed = true;
      }
      const errorCode =
        error instanceof RunInterruptedError
          ? error.kind === 'timeout'
            ? 'run-timeout'
            : 'run-cancelled'
          : error instanceof VerifyRunnerError
            ? error.code
            : 'adapter-error';
      state.errors.push({
        phase,
        code: errorCode,
        ...(sanitizeEvidenceMessage(error.message) !== undefined
          ? { message: sanitizeEvidenceMessage(error.message) }
          : {}),
      });
      return undefined;
    }
  };

  await executePhase('setup', () => adapter.prepare(context, runSignal.signal));

  if (!failed && !interruption) {
    for (let iteration = 1; iteration <= (manifest.scenario.warmupRuns ?? 0); iteration += 1) {
      await executePhase('warmup', () => adapter.warmup(context, iteration, runSignal.signal));
      if (failed || interruption) break;
    }
  }

  if (!failed && !interruption) {
    for (let iteration = 1; iteration <= manifest.scenario.repetitions; iteration += 1) {
      await executePhase('execute', async () => {
        const result = await adapter.execute(context, iteration, runSignal.signal);
        recordIterationResult(state, result ?? {}, iteration);
      });
      if (failed || interruption) break;
      completed += 1;
    }
  }

  const cleanupError = await runCleanup(adapter, context, cleanupTimeoutMs);
  if (cleanupError) {
    state.errors.push({
      phase: 'cleanup',
      code: cleanupError instanceof RunInterruptedError ? 'cleanup-timeout' : 'cleanup-error',
      ...(sanitizeEvidenceMessage(cleanupError.message) !== undefined
        ? { message: sanitizeEvidenceMessage(cleanupError.message) }
        : {}),
    });
    if (!failed && !interruption) {
      failed = true;
    }
  }

  interruption ??= runSignal.interruption();
  runSignal.dispose();

  const status = executionStatus(
    interruption,
    failed,
    completed,
    manifest.scenario.repetitions
  );
  const missingReason = interruption?.kind === 'cancelled' ? 'cancelled' : 'not-run';
  fillMissingTargets(state, missingReason);

  const endMs = Math.max(clock(), startMs);
  const evidence = {
    apiVersion: 'amaryllis.dev/verify/v1alpha1',
    kind: 'VerificationEvidence',
    metadata: {
      id: idFactory(),
      createdAt: isoTime(endMs),
    },
    execution: {
      status,
      startedAt: isoTime(startMs),
      endedAt: isoTime(endMs),
      durationMs: endMs - startMs,
      repetitions: {
        requested: manifest.scenario.repetitions,
        completed,
      },
    },
    subject: structuredClone(manifest.subject),
    environment: structuredClone(capabilities.environment),
    provenance: {
      runner: structuredClone(runnerInfo),
      scenario: {
        id: manifest.scenario.id,
        version: manifest.scenario.version,
      },
      manifestDigest: {
        algorithm: 'sha256',
        value: digestJson(manifest),
      },
      collectors: structuredClone(capabilities.collectors ?? []),
      ...((capabilities.evaluationSuites ?? []).length > 0
        ? { evaluationSuites: structuredClone(capabilities.evaluationSuites) }
        : {}),
    },
    measurements: [...state.measurements.values()].map(summarizeMeasurement),
    checks: [...state.checks.values()],
    evaluations: [...state.evaluations.values()],
    unavailable: [...state.unavailable.values()],
    errors: state.errors,
    policy: structuredClone(manifest.policy),
    decision: {
      status: 'unknown',
      reasons: [],
    },
  };

  evidence.decision = evaluateCompatibility(evidence);

  const evidenceValidation = validator.validateEvidence(evidence);
  if (!evidenceValidation.valid) {
    runnerError('invalid-evidence', validationMessage(evidenceValidation));
  }

  return evidence;
}
