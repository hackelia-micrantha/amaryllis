#!/usr/bin/env node
'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const commander_1 = require('commander');
const fs_1 = __importDefault(require('fs'));
const path_1 = __importDefault(require('path'));
const yaml_1 = require('../parser/yaml');
const engine_1 = require('../policy/engine');
const react_1 = require('../generator/react');
const program = new commander_1.Command();
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
      const specPath = path_1.default.resolve(options.spec);
      if (!fs_1.default.existsSync(specPath)) {
        console.error(`Error: Spec file not found at ${specPath}`);
        process.exit(1);
      }
      const content = fs_1.default.readFileSync(specPath, 'utf8');
      const spec = (0, yaml_1.parseComponentSpec)(content);
      // Validate with Policy Engine
      const policyEngine = new engine_1.PolicyEngine();
      const policyResult = policyEngine.validateSpec(spec);
      if (!policyResult.valid) {
        console.error('Policy Validation Failed:');
        policyResult.errors.forEach((err) => console.error(` - ${err}`));
        process.exit(1);
      }
      // Generate React Code
      const generator = new react_1.ReactGenerator();
      const generatedCode = generator.generate(spec);
      if (options.output) {
        const outputPath = path_1.default.resolve(options.output);
        const outputDir = fs_1.default.lstatSync(outputPath).isDirectory()
          ? outputPath
          : path_1.default.dirname(outputPath);
        if (!fs_1.default.existsSync(outputDir)) {
          fs_1.default.mkdirSync(outputDir, { recursive: true });
        }
        const finalPath = fs_1.default.lstatSync(outputPath).isDirectory()
          ? path_1.default.join(outputPath, `${spec.metadata.name}.tsx`)
          : outputPath;
        fs_1.default.writeFileSync(finalPath, generatedCode);
        console.log(`Successfully generated component at ${finalPath}`);
      } else {
        console.log(generatedCode);
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });
program.parse(process.argv);
