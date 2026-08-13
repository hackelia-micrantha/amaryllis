#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { Command, CommanderError } from 'commander';

import { FakePlatformAdapter } from './fake-adapter.mjs';
import { evaluateCompatibility } from './policy.mjs';
import { runVerification, VerifyRunnerError } from './runner.mjs';
import {
  isLocalPathReference,
  loadVerifySchemaBundle,
  VerifyValidator,
} from './validator.mjs';

const EXIT = {
  ok: 0,
  compatibilityFail: 2,
  compatibilityUnknown: 3,
  invalidInput: 64,
  internalFailure: 70,
};

function repositoryRootFromTool() {
  return path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
}

function defaultValidator() {
  return new VerifyValidator(
    loadVerifySchemaBundle(
      path.join(repositoryRootFromTool(), 'schemas/verify/v1alpha1')
    )
  );
}

function isUncPath(value) {
  return value.startsWith('\\\\') || value.startsWith('//');
}

function resolveLocalPath(value, baseDirectory = process.cwd()) {
  if (!isLocalPathReference(value) || isUncPath(value)) {
    throw new VerifyRunnerError(
      'cli.non-local-path',
      `expected a local filesystem path, got ${value}`
    );
  }
  return path.resolve(baseDirectory, value);
}

async function readJsonFile(filePath) {
  const source = await fs.readFile(filePath, 'utf8');
  return JSON.parse(source);
}

function validationText(result) {
  return result.issues
    .map((issue) => `${issue.path} ${issue.code}: ${issue.message}`)
    .join('\n');
}

function decisionProjection(decision) {
  return {
    status: decision.status,
    reasons: decision.reasons.map(({ requirementId, code }) => ({
      ...(requirementId ? { requirementId } : {}),
      code,
    })),
  };
}

function sameDecision(left, right) {
  return JSON.stringify(decisionProjection(left)) === JSON.stringify(decisionProjection(right));
}

export function renderSummary(evidence) {
  const execution = evidence.execution.status;
  const decision = evidence.decision.status;
  const subject = `${evidence.subject.application.id}@${evidence.subject.application.version}`;
  const model = `${evidence.subject.model.id}@${evidence.subject.model.version ?? '<unversioned>'}`;
  const target = `${evidence.environment.platform} ${evidence.environment.device.model}`;
  return `${subject} / ${model} / ${target}: execution=${execution}, decision=${decision}`;
}

function checkExitCode(evidence) {
  if (evidence.execution.status !== 'completed') {
    return EXIT.compatibilityUnknown;
  }

  switch (evidence.decision.status) {
    case 'pass':
    case 'warn':
      return EXIT.ok;
    case 'fail':
      return EXIT.compatibilityFail;
    case 'unknown':
      return EXIT.compatibilityUnknown;
    default:
      return EXIT.invalidInput;
  }
}

async function writeJsonAtomically(filePath, value) {
  const directory = path.dirname(filePath);
  await fs.access(directory);
  const temporary = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );

  try {
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await fs.rename(temporary, filePath);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

function runnerErrorExitCode(error) {
  if (!(error instanceof VerifyRunnerError)) {
    return EXIT.internalFailure;
  }

  if (
    error.code === 'invalid-manifest' ||
    error.code.startsWith('fixture.') ||
    error.code.startsWith('target.') ||
    error.code.startsWith('cli.')
  ) {
    return EXIT.invalidInput;
  }

  return EXIT.internalFailure;
}

function createProgram({ validator, stdout, stderr, adapterFactory, run = runVerification }) {
  const program = new Command();
  program
    .name('amaryllis-verify')
    .description('Local Amaryllis Verify v1alpha1 tooling')
    .exitOverride()
    .configureOutput({
      writeOut: (text) => stdout(text),
      writeErr: (text) => stderr(text),
    });

  program
    .command('validate')
    .requiredOption('--evidence <path>', 'VerificationEvidence JSON file')
    .action(async ({ evidence: evidencePath }) => {
      const absolute = resolveLocalPath(evidencePath);
      const evidence = await readJsonFile(absolute);
      const result = validator.validateEvidence(evidence);
      if (!result.valid) {
        stderr(`${validationText(result)}\n`);
        program.setOptionValueWithSource('__result', EXIT.invalidInput, 'implied');
        return;
      }
      stdout('valid\n');
      program.setOptionValueWithSource('__result', EXIT.ok, 'implied');
    });

  program
    .command('check')
    .requiredOption('--evidence <path>', 'VerificationEvidence JSON file')
    .action(async ({ evidence: evidencePath }) => {
      const absolute = resolveLocalPath(evidencePath);
      const evidence = await readJsonFile(absolute);
      const result = validator.validateEvidence(evidence);
      if (!result.valid) {
        stderr(`${validationText(result)}\n`);
        program.setOptionValueWithSource('__result', EXIT.invalidInput, 'implied');
        return;
      }

      const derived = evaluateCompatibility(evidence);
      if (!sameDecision(evidence.decision, derived)) {
        stderr('embedded compatibility decision does not match validated evidence and policy\n');
        program.setOptionValueWithSource('__result', EXIT.invalidInput, 'implied');
        return;
      }

      stdout(`${renderSummary(evidence)}\n`);
      program.setOptionValueWithSource('__result', checkExitCode(evidence), 'implied');
    });

  program
    .command('run')
    .requiredOption('--manifest <path>', 'VerificationManifest JSON file')
    .requiredOption('--output <path>', 'output VerificationEvidence JSON file')
    .requiredOption('--adapter-script <path>', 'local deterministic adapter script JSON')
    .action(async ({ manifest: manifestPath, output, adapterScript }) => {
      const absoluteManifest = resolveLocalPath(manifestPath);
      const absoluteAdapter = resolveLocalPath(adapterScript);
      const absoluteOutput = resolveLocalPath(output);
      const manifest = await readJsonFile(absoluteManifest);
      const script = await readJsonFile(absoluteAdapter);
      const adapter = adapterFactory(script);

      const evidence = await run({
        manifest,
        validator,
        adapter,
        baseDirectory: path.dirname(absoluteManifest),
      });
      await writeJsonAtomically(absoluteOutput, evidence);
      stdout(`${renderSummary(evidence)}\n`);
      program.setOptionValueWithSource('__result', EXIT.ok, 'implied');
    });

  return program;
}

export async function runCli(
  argv,
  {
    validator = defaultValidator(),
    stdout = (text) => process.stdout.write(text),
    stderr = (text) => process.stderr.write(text),
    adapterFactory = (script) => new FakePlatformAdapter(script),
    run = runVerification,
  } = {}
) {
  const program = createProgram({ validator, stdout, stderr, adapterFactory, run });

  try {
    await program.parseAsync(argv, { from: 'user' });
    return program.getOptionValue('__result') ?? EXIT.ok;
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === 'commander.helpDisplayed') {
        return EXIT.ok;
      }
      return EXIT.invalidInput;
    }

    if (error instanceof SyntaxError) {
      stderr(`invalid JSON: ${error.message}\n`);
      return EXIT.invalidInput;
    }

    if (error instanceof VerifyRunnerError) {
      stderr(`${error.code}: ${error.message}\n`);
      return runnerErrorExitCode(error);
    }

    stderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return EXIT.internalFailure;
  }
}

async function main() {
  return runCli(process.argv.slice(2));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  process.exitCode = await main();
}
