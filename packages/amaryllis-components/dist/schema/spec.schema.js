"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComponentSpecSchema = exports.ComponentPolicySchema = exports.ComponentAISchema = exports.AIExecutionEnvironmentSchema = exports.AIExecutionModeSchema = exports.ComponentBehaviorSchema = exports.ComponentUISchema = exports.ComponentPropsSchema = exports.ComponentTargetSchema = exports.ComponentMetadataSchema = exports.JsonSchemaValueSchema = exports.StabilitySchema = void 0;
const zod_1 = require("zod");
const JS_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const COMPONENT_NAME = /^[a-z][a-z0-9-]*$/;
const SEMVERISH = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const UNSAFE_LAYOUT_PATTERNS = [
    /<script\b/i,
    /\bimport\s+/,
    /\bexport\s+/,
    /\brequire\s*\(/,
    /\beval\s*\(/,
    /new\s+Function\s*\(/,
];
function addIdentifierIssue(ctx, path, message) {
    ctx.addIssue({
        code: zod_1.z.ZodIssueCode.custom,
        path,
        message,
    });
}
function isSafeIdentifier(value) {
    return (JS_IDENTIFIER.test(value) &&
        !['__proto__', 'constructor', 'prototype'].includes(value));
}
function validateIdentifierList(values, ctx, path, message) {
    values?.forEach((value, index) => {
        if (!isSafeIdentifier(value)) {
            addIdentifierIssue(ctx, [...path, index], message);
        }
    });
}
function validateLayout(layout, ctx, path) {
    if (!layout) {
        return;
    }
    if (UNSAFE_LAYOUT_PATTERNS.some((pattern) => pattern.test(layout))) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path,
            message: 'component layout must not contain imports, exports, scripts, eval, require, or Function constructors',
        });
    }
}
exports.StabilitySchema = zod_1.z.enum(['experimental', 'stable', 'deprecated']);
exports.JsonSchemaValueSchema = zod_1.z.lazy(() => zod_1.z
    .object({
    type: zod_1.z
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
    description: zod_1.z.string().optional(),
    enum: zod_1.z.array(zod_1.z.unknown()).optional(),
    default: zod_1.z.unknown().optional(),
    items: exports.JsonSchemaValueSchema.optional(),
    properties: zod_1.z.record(exports.JsonSchemaValueSchema).optional(),
    required: zod_1.z.array(zod_1.z.string()).optional(),
    additionalProperties: zod_1.z
        .union([zod_1.z.boolean(), exports.JsonSchemaValueSchema])
        .optional(),
})
    .passthrough());
exports.ComponentMetadataSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).regex(COMPONENT_NAME),
    version: zod_1.z.string().regex(SEMVERISH),
    owner: zod_1.z.string().optional(),
    stability: exports.StabilitySchema.optional(),
});
exports.ComponentTargetSchema = zod_1.z.object({
    framework: zod_1.z.literal('react'),
    runtime: zod_1.z.enum(['nextjs', 'web', 'rn']),
    ssr: zod_1.z.boolean().optional(),
});
exports.ComponentPropsSchema = zod_1.z
    .object({
    type: zod_1.z.literal('object'),
    properties: zod_1.z.record(exports.JsonSchemaValueSchema),
    required: zod_1.z.array(zod_1.z.string()).optional(),
})
    .superRefine((props, ctx) => {
    const declaredProps = new Set(Object.keys(props.properties));
    Object.keys(props.properties).forEach((key) => {
        if (!isSafeIdentifier(key)) {
            addIdentifierIssue(ctx, ['properties', key], 'generated component prop names must be valid JavaScript identifiers');
        }
    });
    props.required?.forEach((key, index) => {
        if (!declaredProps.has(key)) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ['required', index],
                message: `required prop '${key}' must reference a declared property`,
            });
        }
    });
});
exports.ComponentUISchema = zod_1.z
    .object({
    layout: zod_1.z.string().optional(),
    slots: zod_1.z.array(zod_1.z.string()).optional(),
    variants: zod_1.z
        .record(zod_1.z.object({
        layout: zod_1.z.string().optional(),
        props: zod_1.z.record(zod_1.z.unknown()).optional(),
    }))
        .optional(),
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
})
    .superRefine((ui, ctx) => {
    validateLayout(ui.layout, ctx, ['layout']);
    validateIdentifierList(ui.slots, ctx, ['slots'], 'slot names must be safe JavaScript identifiers');
    Object.entries(ui.variants ?? {}).forEach(([name, config]) => {
        if (!isSafeIdentifier(name)) {
            addIdentifierIssue(ctx, ['variants', name], 'variant names must be safe JavaScript identifiers');
        }
        validateLayout(config.layout, ctx, ['variants', name, 'layout']);
    });
    validateIdentifierList(ui.designTokens?.spacing, ctx, ['designTokens', 'spacing'], 'design token names must be safe JavaScript identifiers');
    validateIdentifierList(ui.designTokens?.typography, ctx, ['designTokens', 'typography'], 'design token names must be safe JavaScript identifiers');
    validateIdentifierList(ui.designTokens?.colorRoles, ctx, ['designTokens', 'colorRoles'], 'design token names must be safe JavaScript identifiers');
});
exports.ComponentBehaviorSchema = zod_1.z.object({
    state: zod_1.z.record(zod_1.z.unknown()).optional(),
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
exports.ComponentAISchema = zod_1.z
    .object({
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
})
    .superRefine((ai, ctx) => {
    if (ai.execution !== 'device') {
        return;
    }
    if (ai.mode === 'scaffold') {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['mode'],
            message: 'scaffold mode cannot execute on device',
        });
    }
    if (!ai.generationContract) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['generationContract'],
            message: 'device execution requires a structured generation contract',
        });
        return;
    }
    if (ai.generationContract.output === 'tsx') {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['generationContract', 'output'],
            message: 'device execution cannot output TSX or executable code',
        });
    }
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
    apiVersion: zod_1.z.literal('amaryllis/v1alpha1'),
    kind: zod_1.z.literal('ComponentSpec'),
    metadata: exports.ComponentMetadataSchema,
    target: exports.ComponentTargetSchema,
    props: exports.ComponentPropsSchema,
    ui: exports.ComponentUISchema.optional(),
    behavior: exports.ComponentBehaviorSchema.optional(),
    ai: exports.ComponentAISchema,
    policy: exports.ComponentPolicySchema.optional(),
});
