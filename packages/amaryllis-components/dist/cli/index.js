#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const yaml_1 = require("../parser/yaml");
const engine_1 = require("../policy/engine");
const react_1 = require("../generator/react");
const schema_1 = require("../generator/schema");
const jsonpatch = __importStar(require("fast-json-patch"));
const diff_1 = require("./diff");
const program = new commander_1.Command();
function hashContent(content) {
    return crypto_1.default.createHash('sha256').update(content).digest('hex');
}
function errorMessage(err) {
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
        const generatedCode = generator.generate(spec, {
            specHash: hashContent(content),
            validationSummary: 'schema-and-policy-passed',
        });
        if (options.output) {
            const outputPath = path_1.default.resolve(options.output);
            const outputExists = fs_1.default.existsSync(outputPath);
            const outputDir = outputExists && fs_1.default.lstatSync(outputPath).isDirectory()
                ? outputPath
                : path_1.default.dirname(outputPath);
            if (!fs_1.default.existsSync(outputDir)) {
                fs_1.default.mkdirSync(outputDir, { recursive: true });
            }
            const finalPath = outputExists && fs_1.default.lstatSync(outputPath).isDirectory()
                ? path_1.default.join(outputPath, `${spec.metadata.name}.tsx`)
                : outputPath;
            fs_1.default.writeFileSync(finalPath, generatedCode);
            console.log(`Successfully generated component at ${finalPath}`);
        }
        else {
            console.log(generatedCode);
        }
    }
    catch (err) {
        console.error(`Error: ${errorMessage(err)}`);
        process.exit(1);
    }
});
program
    .command('contract')
    .description('Generate a JSON schema personalization contract from a ComponentSpec')
    .requiredOption('-s, --spec <path>', 'Path to the ComponentSpec YAML file')
    .action((options) => {
    try {
        const specPath = path_1.default.resolve(options.spec);
        const content = fs_1.default.readFileSync(specPath, 'utf8');
        const spec = (0, yaml_1.parseComponentSpec)(content);
        const generator = new schema_1.JSONSchemaGenerator();
        console.log(generator.generate(spec));
    }
    catch (err) {
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
        const specPath = path_1.default.resolve(options.spec);
        const patchPath = path_1.default.resolve(options.patch);
        const specContent = fs_1.default.readFileSync(specPath, 'utf8');
        const spec = (0, yaml_1.parseComponentSpec)(specContent);
        const patchContent = fs_1.default.readFileSync(patchPath, 'utf8');
        const patch = JSON.parse(patchContent);
        // Apply patch
        const patchedSpec = jsonpatch.applyPatch(spec, patch).newDocument;
        // Validate patched spec
        const policyEngine = new engine_1.PolicyEngine();
        const policyResult = policyEngine.validateSpec(patchedSpec);
        if (!policyResult.valid) {
            console.error('Patched Spec Policy Validation Failed:');
            policyResult.errors.forEach((err) => console.error(` - ${err}`));
            process.exit(1);
        }
        // Generate
        const generator = new react_1.ReactGenerator();
        const oldCode = generator.generate(spec, {
            specHash: hashContent(specContent),
            validationSummary: 'schema-and-policy-passed',
        });
        const newCode = generator.generate(patchedSpec, {
            specHash: hashContent(JSON.stringify(patchedSpec)),
            validationSummary: 'schema-and-policy-passed',
        });
        if (options.output) {
            const outputPath = path_1.default.resolve(options.output);
            fs_1.default.writeFileSync(outputPath, newCode);
            console.log(`Successfully generated customized component at ${outputPath}`);
        }
        else {
            console.log('--- BEGIN DIFF ---');
            console.log((0, diff_1.getLineDiff)(oldCode, newCode));
            console.log('--- END DIFF ---');
        }
    }
    catch (err) {
        console.error(`Error: ${errorMessage(err)}`);
        process.exit(1);
    }
});
program.parse(process.argv);
