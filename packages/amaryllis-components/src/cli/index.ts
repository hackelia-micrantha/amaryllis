#!/usr/bin/env node
import { Command } from 'commander';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { parseComponentSpec } from '../parser/yaml';
import { PolicyEngine } from '../policy/engine';
import { ReactGenerator } from '../generator/react';
import { JSONSchemaGenerator } from '../generator/schema';
import * as jsonpatch from 'fast-json-patch';
import { getLineDiff } from './diff';

const program = new Command();

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

program
  .name('amaryllis-components')
  .description('CLI for Amaryllis Components Companion Module')
  .version('0.1.0');

program
  .command('generate')
  .description('Generate a React component from a ComponentSpec')
  .requiredOption('-s, --spec <path>', 'Path to the ComponentSpec YAML file')
  .option('-o, --output <path>', 'Output directory or file path')
  .action((options) => {
    try {
      const specPath = path.resolve(options.spec);
      if (!fs.existsSync(specPath)) {
        console.error(`Error: Spec file not found at ${specPath}`);
        process.exit(1);
      }

      const content = fs.readFileSync(specPath, 'utf8');
      const spec = parseComponentSpec(content);

      // Validate with Policy Engine
      const policyEngine = new PolicyEngine();
      const policyResult = policyEngine.validateSpec(spec);

      if (!policyResult.valid) {
        console.error('Policy Validation Failed:');
        policyResult.errors.forEach((err) => console.error(` - ${err}`));
        process.exit(1);
      }

      // Generate React Code
      const generator = new ReactGenerator();
      const generatedCode = generator.generate(spec, {
        specHash: hashContent(content),
        validationSummary: 'schema-and-policy-passed',
      });

      if (options.output) {
        const outputPath = path.resolve(options.output);
        const outputExists = fs.existsSync(outputPath);
        const outputDir =
          outputExists && fs.lstatSync(outputPath).isDirectory()
            ? outputPath
            : path.dirname(outputPath);

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const finalPath =
          outputExists && fs.lstatSync(outputPath).isDirectory()
            ? path.join(outputPath, `${spec.metadata.name}.tsx`)
            : outputPath;

        fs.writeFileSync(finalPath, generatedCode);
        console.log(`Successfully generated component at ${finalPath}`);
      } else {
        console.log(generatedCode);
      }
    } catch (err: unknown) {
      console.error(`Error: ${errorMessage(err)}`);
      process.exit(1);
    }
  });

program
  .command('contract')
  .description(
    'Generate a JSON schema personalization contract from a ComponentSpec'
  )
  .requiredOption('-s, --spec <path>', 'Path to the ComponentSpec YAML file')
  .action((options) => {
    try {
      const specPath = path.resolve(options.spec);
      const content = fs.readFileSync(specPath, 'utf8');
      const spec = parseComponentSpec(content);

      const generator = new JSONSchemaGenerator();
      console.log(generator.generate(spec));
    } catch (err: unknown) {
      console.error(`Error: ${errorMessage(err)}`);
      process.exit(1);
    }
  });

program
  .command('customize')
  .description('Apply a customization patch to a spec and regenerate')
  .requiredOption('-s, --spec <path>', 'Path to the ComponentSpec YAML file')
  .requiredOption('-p, --patch <path>', 'Path to the JSON Patch file')
  .option('-o, --output <path>', 'Output path for the generated component')
  .action((options) => {
    try {
      const specPath = path.resolve(options.spec);
      const patchPath = path.resolve(options.patch);

      const specContent = fs.readFileSync(specPath, 'utf8');
      const spec = parseComponentSpec(specContent);

      const patchContent = fs.readFileSync(patchPath, 'utf8');
      const patch = JSON.parse(patchContent);

      // Apply patch
      const patchedSpec = jsonpatch.applyPatch(spec, patch).newDocument;

      // Validate patched spec
      const policyEngine = new PolicyEngine();
      const policyResult = policyEngine.validateSpec(patchedSpec);

      if (!policyResult.valid) {
        console.error('Patched Spec Policy Validation Failed:');
        policyResult.errors.forEach((err) => console.error(` - ${err}`));
        process.exit(1);
      }

      // Generate
      const generator = new ReactGenerator();
      const oldCode = generator.generate(spec, {
        specHash: hashContent(specContent),
        validationSummary: 'schema-and-policy-passed',
      });
      const newCode = generator.generate(patchedSpec, {
        specHash: hashContent(JSON.stringify(patchedSpec)),
        validationSummary: 'schema-and-policy-passed',
      });

      if (options.output) {
        const outputPath = path.resolve(options.output);
        fs.writeFileSync(outputPath, newCode);
        console.log(
          `Successfully generated customized component at ${outputPath}`
        );
      } else {
        console.log('--- BEGIN DIFF ---');
        console.log(getLineDiff(oldCode, newCode));
        console.log('--- END DIFF ---');
      }
    } catch (err: unknown) {
      console.error(`Error: ${errorMessage(err)}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
