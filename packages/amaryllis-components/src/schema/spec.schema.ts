import { z } from 'zod';

const JS_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const COMPONENT_NAME = /^[a-z][a-z0-9-]*$/;
const SEMVERISH = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const JS_TRIVIA = String.raw`(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*(?:\r?\n|$))*`;
const UNSAFE_LAYOUT_PATTERNS = [
  /<script\b/i,
  /\bimport\s+/i,
  new RegExp(`\\bimport${JS_TRIVIA}\\(`, 'i'),
  /\bexport\s+/i,
  new RegExp(`\\brequire${JS_TRIVIA}\\(`, 'i'),
  new RegExp(`\\beval${JS_TRIVIA}\\(`, 'i'),
  new RegExp(`\\b(?:new${JS_TRIVIA})?Function${JS_TRIVIA}\\(`, 'i'),
];

function addIdentifierIssue(
  ctx: z.RefinementCtx,
  path: (string | number)[],
  message: string
): void {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path,
    message,
  });
}

function isSafeIdentifier(value: string): boolean {
  return (
    JS_IDENTIFIER.test(value) &&
    !['__proto__', 'constructor', 'prototype'].includes(value)
  );
}

function validateIdentifierList(
  values: string[] | undefined,
  ctx: z.RefinementCtx,
  path: string[],
  message: string
): void {
  values?.forEach((value, index) => {
    if (!isSafeIdentifier(value)) {
      addIdentifierIssue(ctx, [...path, index], message);
    }
  });
}

function validateLayout(
  layout: string | undefined,
  ctx: z.RefinementCtx,
  path: string[]
): void {
  if (!layout) {
    return;
  }

  if (UNSAFE_LAYOUT_PATTERNS.some((pattern) => pattern.test(layout))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path,
      message:
        'component layout must not contain imports, exports, scripts, eval, require, or Function constructors',
    });
  }
}

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
  name: z.string().min(1).regex(COMPONENT_NAME),
  version: z.string().regex(SEMVERISH),
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
    const declaredProps = new Set(Object.keys(props.properties));

    Object.keys(props.properties).forEach((key) => {
      if (!isSafeIdentifier(key)) {
        addIdentifierIssue(
          ctx,
          ['properties', key],
          'generated component prop names must be valid JavaScript identifiers'
        );
      }
    });

    props.required?.forEach((key, index) => {
      if (!declaredProps.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['required', index],
          message: `required prop '${key}' must reference a declared property`,
        });
      }
    });
  });

export const ComponentUISchema = z
  .object({
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
  })
  .superRefine((ui, ctx) => {
    validateLayout(ui.layout, ctx, ['layout']);
    validateIdentifierList(
      ui.slots,
      ctx,
      ['slots'],
      'slot names must be safe JavaScript identifiers'
    );

    Object.entries(ui.variants ?? {}).forEach(([name, config]) => {
      if (!isSafeIdentifier(name)) {
        addIdentifierIssue(
          ctx,
          ['variants', name],
          'variant names must be safe JavaScript identifiers'
        );
      }
      validateLayout(config.layout, ctx, ['variants', name, 'layout']);
    });

    validateIdentifierList(
      ui.designTokens?.spacing,
      ctx,
      ['designTokens', 'spacing'],
      'design token names must be safe JavaScript identifiers'
    );
    validateIdentifierList(
      ui.designTokens?.typography,
      ctx,
      ['designTokens', 'typography'],
      'design token names must be safe JavaScript identifiers'
    );
    validateIdentifierList(
      ui.designTokens?.colorRoles,
      ctx,
      ['designTokens', 'colorRoles'],
      'design token names must be safe JavaScript identifiers'
    );
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