import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = path.join(root, 'packages/amaryllis-components');
const distRoot = path.join(packageRoot, 'dist');
const cli = path.join(distRoot, 'cli/index.js');
const specPath = path.join(root, 'docs/examples/summary-card.component.yaml');
const patchPath = path.join(
  root,
  'docs/examples/summary-card.customization.patch.json'
);
const validOutputPath = path.join(
  root,
  'docs/examples/summary-card.personalization.valid.json'
);
const invalidOutputPath = path.join(
  root,
  'docs/examples/summary-card.personalization.invalid.json'
);

// Import only the provider-free modules exercised by this verifier. Importing the
// package barrel also loads React Native runtime primitives, which are not valid
// in a plain Node.js build/CI process.
const { ComponentRegistry } = require(path.join(
  distRoot,
  'runtime/registry.js'
));
const { PersonalizationEngine } = require(path.join(
  distRoot,
  'runtime/engine.js'
));
const { JSONSchemaGenerator } = require(path.join(
  distRoot,
  'generator/schema.js'
));
const { parseComponentSpec } = require(path.join(
  distRoot,
  'parser/yaml.js'
));

const tempDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'amaryllis-components-example-')
);

try {
  const generatedPath = path.join(tempDirectory, 'SummaryCard.tsx');
  const customizedPath = path.join(tempDirectory, 'SummaryCard.customized.tsx');

  execFileSync(
    process.execPath,
    [cli, 'generate', '--spec', specPath, '--output', generatedPath],
    { cwd: root, stdio: 'pipe' }
  );
  const generatedCode = fs.readFileSync(generatedPath, 'utf8');
  assert.match(generatedCode, /SummaryCard/);

  const contractOutput = execFileSync(
    process.execPath,
    [cli, 'contract', '--spec', specPath],
    { cwd: root, encoding: 'utf8' }
  );
  const contract = JSON.parse(contractOutput);
  assert.equal(contract.title, 'SummaryCard Personalization Contract');

  execFileSync(
    process.execPath,
    [
      cli,
      'customize',
      '--spec',
      specPath,
      '--patch',
      patchPath,
      '--output',
      customizedPath,
    ],
    { cwd: root, stdio: 'pipe' }
  );
  const customizedCode = fs.readFileSync(customizedPath, 'utf8');
  assert.notEqual(customizedCode, generatedCode);
  assert.match(customizedCode, /SummaryCard/);

  const spec = parseComponentSpec(fs.readFileSync(specPath, 'utf8'));
  const generatedContract = JSON.parse(new JSONSchemaGenerator().generate(spec));
  assert.deepEqual(contract, generatedContract);

  const registry = new ComponentRegistry();
  const SummaryCard = () => null;
  registry.register('SummaryCard', {
    component: SummaryCard,
    spec,
    contract: generatedContract,
    implementationIdentity: 'docs/examples/SummaryCard',
  });
  assert.ok(registry.get('SummaryCard'));

  const engine = new PersonalizationEngine();
  const baseProps = {
    title: 'Base title',
    summary: 'Base summary',
    variant: 'expanded',
  };
  const validOutput = JSON.parse(fs.readFileSync(validOutputPath, 'utf8'));
  const validResult = engine.validate(generatedContract, validOutput);
  assert.equal(validResult.valid, true);
  assert.deepEqual(engine.apply(baseProps, validResult.data ?? {}), {
    title: 'Local context',
    summary: 'A validated, structured summary generated from local context.',
    variant: 'compact',
  });

  const invalidOutput = JSON.parse(fs.readFileSync(invalidOutputPath, 'utf8'));
  const invalidResult = engine.validate(generatedContract, invalidOutput);
  assert.equal(invalidResult.valid, false);

  const fallbackProps = invalidResult.valid
    ? engine.apply(baseProps, invalidResult.data ?? {})
    : baseProps;
  assert.deepEqual(fallbackProps, baseProps);

  console.log('AI component examples verified.');
} finally {
  fs.rmSync(tempDirectory, { recursive: true, force: true });
}
