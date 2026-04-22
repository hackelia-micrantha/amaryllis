import { z } from 'zod';

export const StabilitySchema = z.enum(['experimental', 'stable', 'deprecated']);

export const ComponentMetadataSchema = z.object({
  name: z.string(),
  version: z.string(),
  owner: z.string().optional(),
  stability: StabilitySchema.optional(),
});

export const ComponentTargetSchema = z.object({
  framework: z.literal('react'),
  runtime: z.enum(['nextjs', 'web', 'rn']),
  ssr: z.boolean().optional(),
});

export const ComponentPropsSchema = z.object({
  type: z.literal('object'),
  properties: z.record(z.any()),
  required: z.array(z.string()).optional(),
});

export const ComponentUISchema = z.object({
  layout: z.string().optional(),
  slots: z.array(z.string()).optional(),
  designTokens: z
    .object({
      spacing: z.array(z.string()).optional(),
      typography: z.array(z.string()).optional(),
      colorRoles: z.array(z.string()).optional(),
    })
    .optional(),
  accessibility: z
    .object({
      rules: z.array(z.string()).optional(),
    })
    .optional(),
});

export const ComponentBehaviorSchema = z.object({
  state: z.record(z.any()).optional(),
  events: z.array(z.string()).optional(),
  sideEffects: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
});

export const AIExecutionModeSchema = z.enum([
  'scaffold',
  'customize',
  'personalize',
]);
export const AIExecutionEnvironmentSchema = z.enum(['build', 'ci', 'device']);

export const ComponentAISchema = z.object({
  mode: AIExecutionModeSchema,
  execution: AIExecutionEnvironmentSchema,
  allowedOperations: z.array(z.string()).optional(),
  forbiddenOperations: z.array(z.string()).optional(),
  generationContract: z
    .object({
      output: z.enum(['tsx', 'props-json', 'variant-selection', 'json-patch']),
      schemaRef: z.string().optional(),
      styleSystem: z.enum(['tailwind', 'css-modules']).optional(),
      constraints: z.array(z.string()).optional(),
    })
    .optional(),
  validators: z.array(z.string()).optional(),
});

export const ComponentPolicySchema = z.object({
  imports: z
    .object({
      allow: z.array(z.string()).optional(),
      deny: z.array(z.string()).optional(),
    })
    .optional(),
  runtime: z
    .object({
      networkAccess: z.enum(['restricted', 'none']).optional(),
      domAccess: z.enum(['restricted', 'none']).optional(),
    })
    .optional(),
  review: z
    .object({
      requireHumanApproval: z.boolean().optional(),
    })
    .optional(),
});

export const ComponentSpecSchema = z.object({
  apiVersion: z.string(),
  kind: z.literal('ComponentSpec'),
  metadata: ComponentMetadataSchema,
  target: ComponentTargetSchema,
  props: ComponentPropsSchema,
  ui: ComponentUISchema.optional(),
  behavior: ComponentBehaviorSchema.optional(),
  ai: ComponentAISchema,
  policy: ComponentPolicySchema.optional(),
});

export type ValidatedComponentSpec = z.infer<typeof ComponentSpecSchema>;
