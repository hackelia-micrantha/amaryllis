import { z } from 'zod';

export const StabilitySchema = z.enum(['experimental', 'stable', 'deprecated']);
export const JsonSchemaValueSchema: z.ZodType = z.lazy(() =>
  z
    .object({
      type: z
        .enum([
          'string',
          'number',
          'integer',
          'boolean',
          'array',
          'object',
          'null',
        ])
        .optional(),
      description: z.string().optional(),
      enum: z.array(z.unknown()).optional(),
      default: z.unknown().optional(),
      items: JsonSchemaValueSchema.optional(),
      properties: z.record(JsonSchemaValueSchema).optional(),
      required: z.array(z.string()).optional(),
      additionalProperties: z
        .union([z.boolean(), JsonSchemaValueSchema])
        .optional(),
    })
    .passthrough()
);

export const ComponentMetadataSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9-]*$/),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/),
  owner: z.string().optional(),
  stability: StabilitySchema.optional(),
});

export const ComponentTargetSchema = z.object({
  framework: z.literal('react'),
  runtime: z.enum(['nextjs', 'web', 'rn']),
  ssr: z.boolean().optional(),
});

export const ComponentPropsSchema = z
  .object({
    type: z.literal('object'),
    properties: z.record(JsonSchemaValueSchema),
    required: z.array(z.string()).optional(),
  })
  .superRefine((props, ctx) => {
    Object.keys(props.properties).forEach((key) => {
      if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['properties', key],
          message:
            'generated component prop names must be valid JavaScript identifiers',
        });
      }
    });
  });

export const ComponentUISchema = z.object({
  layout: z.string().optional(),
  slots: z.array(z.string()).optional(),
  variants: z
    .record(
      z.object({
        layout: z.string().optional(),
        props: z.record(z.unknown()).optional(),
      })
    )
    .optional(),
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
  state: z.record(z.unknown()).optional(),
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

export const ComponentAISchema = z
  .object({
    mode: AIExecutionModeSchema,
    execution: AIExecutionEnvironmentSchema,
    allowedOperations: z.array(z.string()).optional(),
    forbiddenOperations: z.array(z.string()).optional(),
    generationContract: z
      .object({
        output: z.enum([
          'tsx',
          'props-json',
          'variant-selection',
          'json-patch',
        ]),
        schemaRef: z.string().optional(),
        styleSystem: z.enum(['tailwind', 'css-modules']).optional(),
        constraints: z.array(z.string()).optional(),
      })
      .optional(),
    validators: z.array(z.string()).optional(),
  })
  .superRefine((ai, ctx) => {
    if (ai.execution !== 'device') {
      return;
    }

    if (ai.mode === 'scaffold') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mode'],
        message: 'scaffold mode cannot execute on device',
      });
    }

    if (!ai.generationContract) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['generationContract'],
        message: 'device execution requires a structured generation contract',
      });
      return;
    }

    if (ai.generationContract.output === 'tsx') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['generationContract', 'output'],
        message: 'device execution cannot output TSX or executable code',
      });
    }
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
  apiVersion: z.literal('amaryllis/v1alpha1'),
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
