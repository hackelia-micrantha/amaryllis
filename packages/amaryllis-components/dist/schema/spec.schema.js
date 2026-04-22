'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ComponentSpecSchema =
  exports.ComponentPolicySchema =
  exports.ComponentAISchema =
  exports.AIExecutionEnvironmentSchema =
  exports.AIExecutionModeSchema =
  exports.ComponentBehaviorSchema =
  exports.ComponentUISchema =
  exports.ComponentPropsSchema =
  exports.ComponentTargetSchema =
  exports.ComponentMetadataSchema =
  exports.StabilitySchema =
    void 0;
const zod_1 = require('zod');
exports.StabilitySchema = zod_1.z.enum([
  'experimental',
  'stable',
  'deprecated',
]);
exports.ComponentMetadataSchema = zod_1.z.object({
  name: zod_1.z.string(),
  version: zod_1.z.string(),
  owner: zod_1.z.string().optional(),
  stability: exports.StabilitySchema.optional(),
});
exports.ComponentTargetSchema = zod_1.z.object({
  framework: zod_1.z.literal('react'),
  runtime: zod_1.z.enum(['nextjs', 'web', 'rn']),
  ssr: zod_1.z.boolean().optional(),
});
exports.ComponentPropsSchema = zod_1.z.object({
  type: zod_1.z.literal('object'),
  properties: zod_1.z.record(zod_1.z.any()),
  required: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.ComponentUISchema = zod_1.z.object({
  layout: zod_1.z.string().optional(),
  slots: zod_1.z.array(zod_1.z.string()).optional(),
  designTokens: zod_1.z
    .object({
      spacing: zod_1.z.array(zod_1.z.string()).optional(),
      typography: zod_1.z.array(zod_1.z.string()).optional(),
      colorRoles: zod_1.z.array(zod_1.z.string()).optional(),
    })
    .optional(),
  accessibility: zod_1.z
    .object({
      rules: zod_1.z.array(zod_1.z.string()).optional(),
    })
    .optional(),
});
exports.ComponentBehaviorSchema = zod_1.z.object({
  state: zod_1.z.record(zod_1.z.any()).optional(),
  events: zod_1.z.array(zod_1.z.string()).optional(),
  sideEffects: zod_1.z.array(zod_1.z.string()).optional(),
  constraints: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.AIExecutionModeSchema = zod_1.z.enum([
  'scaffold',
  'customize',
  'personalize',
]);
exports.AIExecutionEnvironmentSchema = zod_1.z.enum(['build', 'ci', 'device']);
exports.ComponentAISchema = zod_1.z.object({
  mode: exports.AIExecutionModeSchema,
  execution: exports.AIExecutionEnvironmentSchema,
  allowedOperations: zod_1.z.array(zod_1.z.string()).optional(),
  forbiddenOperations: zod_1.z.array(zod_1.z.string()).optional(),
  generationContract: zod_1.z
    .object({
      output: zod_1.z.enum([
        'tsx',
        'props-json',
        'variant-selection',
        'json-patch',
      ]),
      schemaRef: zod_1.z.string().optional(),
      styleSystem: zod_1.z.enum(['tailwind', 'css-modules']).optional(),
      constraints: zod_1.z.array(zod_1.z.string()).optional(),
    })
    .optional(),
  validators: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.ComponentPolicySchema = zod_1.z.object({
  imports: zod_1.z
    .object({
      allow: zod_1.z.array(zod_1.z.string()).optional(),
      deny: zod_1.z.array(zod_1.z.string()).optional(),
    })
    .optional(),
  runtime: zod_1.z
    .object({
      networkAccess: zod_1.z.enum(['restricted', 'none']).optional(),
      domAccess: zod_1.z.enum(['restricted', 'none']).optional(),
    })
    .optional(),
  review: zod_1.z
    .object({
      requireHumanApproval: zod_1.z.boolean().optional(),
    })
    .optional(),
});
exports.ComponentSpecSchema = zod_1.z.object({
  apiVersion: zod_1.z.string(),
  kind: zod_1.z.literal('ComponentSpec'),
  metadata: exports.ComponentMetadataSchema,
  target: exports.ComponentTargetSchema,
  props: exports.ComponentPropsSchema,
  ui: exports.ComponentUISchema.optional(),
  behavior: exports.ComponentBehaviorSchema.optional(),
  ai: exports.ComponentAISchema,
  policy: exports.ComponentPolicySchema.optional(),
});
