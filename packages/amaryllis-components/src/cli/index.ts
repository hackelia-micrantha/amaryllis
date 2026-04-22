#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { parseComponentSpec } from '../parser/yaml';
import { PolicyEngine } from '../policy/engine';
import { ReactGenerator } from '../generator/react';

const program = new Command();

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
      const generatedCode = generator.generate(spec);

      if (options.output) {
        const outputPath = path.resolve(options.output);
        const outputDir = fs.lstatSync(outputPath).isDirectory()
          ? outputPath
          : path.dirname(outputPath);

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const finalPath = fs.lstatSync(outputPath).isDirectory()
          ? path.join(outputPath, `${spec.metadata.name}.tsx`)
          : outputPath;

        fs.writeFileSync(finalPath, generatedCode);
        console.log(`Successfully generated component at ${finalPath}`);
      } else {
        console.log(generatedCode);
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
