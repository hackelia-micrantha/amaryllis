import { z } from 'zod';
export declare const StabilitySchema: z.ZodEnum<["experimental", "stable", "deprecated"]>;
export declare const JsonSchemaValueSchema: z.ZodType;
export declare const ComponentMetadataSchema: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodString;
    owner: z.ZodOptional<z.ZodString>;
    stability: z.ZodOptional<z.ZodEnum<["experimental", "stable", "deprecated"]>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    version: string;
    owner?: string | undefined;
    stability?: "experimental" | "stable" | "deprecated" | undefined;
}, {
    name: string;
    version: string;
    owner?: string | undefined;
    stability?: "experimental" | "stable" | "deprecated" | undefined;
}>;
export declare const ComponentTargetSchema: z.ZodObject<{
    framework: z.ZodLiteral<"react">;
    runtime: z.ZodEnum<["nextjs", "web", "rn"]>;
    ssr: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    framework: "react";
    runtime: "nextjs" | "web" | "rn";
    ssr?: boolean | undefined;
}, {
    framework: "react";
    runtime: "nextjs" | "web" | "rn";
    ssr?: boolean | undefined;
}>;
export declare const ComponentPropsSchema: z.ZodEffects<z.ZodObject<{
    type: z.ZodLiteral<"object">;
    properties: z.ZodRecord<z.ZodString, z.ZodType<any, z.ZodTypeDef, any>>;
    required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "object";
    properties: Record<string, any>;
    required?: string[] | undefined;
}, {
    type: "object";
    properties: Record<string, any>;
    required?: string[] | undefined;
}>, {
    type: "object";
    properties: Record<string, any>;
    required?: string[] | undefined;
}, {
    type: "object";
    properties: Record<string, any>;
    required?: string[] | undefined;
}>;
export declare const ComponentUISchema: z.ZodObject<{
    layout: z.ZodOptional<z.ZodString>;
    slots: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    variants: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        layout: z.ZodOptional<z.ZodString>;
        props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        layout?: string | undefined;
        props?: Record<string, unknown> | undefined;
    }, {
        layout?: string | undefined;
        props?: Record<string, unknown> | undefined;
    }>>>;
    designTokens: z.ZodOptional<z.ZodObject<{
        spacing: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        typography: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        colorRoles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        spacing?: string[] | undefined;
        typography?: string[] | undefined;
        colorRoles?: string[] | undefined;
    }, {
        spacing?: string[] | undefined;
        typography?: string[] | undefined;
        colorRoles?: string[] | undefined;
    }>>;
    accessibility: z.ZodOptional<z.ZodObject<{
        rules: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        rules?: string[] | undefined;
    }, {
        rules?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    layout?: string | undefined;
    slots?: string[] | undefined;
    variants?: Record<string, {
        layout?: string | undefined;
        props?: Record<string, unknown> | undefined;
    }> | undefined;
    designTokens?: {
        spacing?: string[] | undefined;
        typography?: string[] | undefined;
        colorRoles?: string[] | undefined;
    } | undefined;
    accessibility?: {
        rules?: string[] | undefined;
    } | undefined;
}, {
    layout?: string | undefined;
    slots?: string[] | undefined;
    variants?: Record<string, {
        layout?: string | undefined;
        props?: Record<string, unknown> | undefined;
    }> | undefined;
    designTokens?: {
        spacing?: string[] | undefined;
        typography?: string[] | undefined;
        colorRoles?: string[] | undefined;
    } | undefined;
    accessibility?: {
        rules?: string[] | undefined;
    } | undefined;
}>;
export declare const ComponentBehaviorSchema: z.ZodObject<{
    state: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    events: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sideEffects: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    constraints: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    state?: Record<string, unknown> | undefined;
    events?: string[] | undefined;
    sideEffects?: string[] | undefined;
    constraints?: string[] | undefined;
}, {
    state?: Record<string, unknown> | undefined;
    events?: string[] | undefined;
    sideEffects?: string[] | undefined;
    constraints?: string[] | undefined;
}>;
export declare const AIExecutionModeSchema: z.ZodEnum<["scaffold", "customize", "personalize"]>;
export declare const AIExecutionEnvironmentSchema: z.ZodEnum<["build", "ci", "device"]>;
export declare const ComponentAISchema: z.ZodEffects<z.ZodObject<{
    mode: z.ZodEnum<["scaffold", "customize", "personalize"]>;
    execution: z.ZodEnum<["build", "ci", "device"]>;
    allowedOperations: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    forbiddenOperations: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    generationContract: z.ZodOptional<z.ZodObject<{
        output: z.ZodEnum<["tsx", "props-json", "variant-selection", "json-patch"]>;
        schemaRef: z.ZodOptional<z.ZodString>;
        styleSystem: z.ZodOptional<z.ZodEnum<["tailwind", "css-modules"]>>;
        constraints: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        output: "tsx" | "props-json" | "variant-selection" | "json-patch";
        constraints?: string[] | undefined;
        schemaRef?: string | undefined;
        styleSystem?: "tailwind" | "css-modules" | undefined;
    }, {
        output: "tsx" | "props-json" | "variant-selection" | "json-patch";
        constraints?: string[] | undefined;
        schemaRef?: string | undefined;
        styleSystem?: "tailwind" | "css-modules" | undefined;
    }>>;
    validators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    mode: "scaffold" | "customize" | "personalize";
    execution: "build" | "ci" | "device";
    allowedOperations?: string[] | undefined;
    forbiddenOperations?: string[] | undefined;
    generationContract?: {
        output: "tsx" | "props-json" | "variant-selection" | "json-patch";
        constraints?: string[] | undefined;
        schemaRef?: string | undefined;
        styleSystem?: "tailwind" | "css-modules" | undefined;
    } | undefined;
    validators?: string[] | undefined;
}, {
    mode: "scaffold" | "customize" | "personalize";
    execution: "build" | "ci" | "device";
    allowedOperations?: string[] | undefined;
    forbiddenOperations?: string[] | undefined;
    generationContract?: {
        output: "tsx" | "props-json" | "variant-selection" | "json-patch";
        constraints?: string[] | undefined;
        schemaRef?: string | undefined;
        styleSystem?: "tailwind" | "css-modules" | undefined;
    } | undefined;
    validators?: string[] | undefined;
}>, {
    mode: "scaffold" | "customize" | "personalize";
    execution: "build" | "ci" | "device";
    allowedOperations?: string[] | undefined;
    forbiddenOperations?: string[] | undefined;
    generationContract?: {
        output: "tsx" | "props-json" | "variant-selection" | "json-patch";
        constraints?: string[] | undefined;
        schemaRef?: string | undefined;
        styleSystem?: "tailwind" | "css-modules" | undefined;
    } | undefined;
    validators?: string[] | undefined;
}, {
    mode: "scaffold" | "customize" | "personalize";
    execution: "build" | "ci" | "device";
    allowedOperations?: string[] | undefined;
    forbiddenOperations?: string[] | undefined;
    generationContract?: {
        output: "tsx" | "props-json" | "variant-selection" | "json-patch";
        constraints?: string[] | undefined;
        schemaRef?: string | undefined;
        styleSystem?: "tailwind" | "css-modules" | undefined;
    } | undefined;
    validators?: string[] | undefined;
}>;
export declare const ComponentPolicySchema: z.ZodObject<{
    imports: z.ZodOptional<z.ZodObject<{
        allow: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        deny: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        allow?: string[] | undefined;
        deny?: string[] | undefined;
    }, {
        allow?: string[] | undefined;
        deny?: string[] | undefined;
    }>>;
    runtime: z.ZodOptional<z.ZodObject<{
        networkAccess: z.ZodOptional<z.ZodEnum<["restricted", "none"]>>;
        domAccess: z.ZodOptional<z.ZodEnum<["restricted", "none"]>>;
    }, "strip", z.ZodTypeAny, {
        networkAccess?: "restricted" | "none" | undefined;
        domAccess?: "restricted" | "none" | undefined;
    }, {
        networkAccess?: "restricted" | "none" | undefined;
        domAccess?: "restricted" | "none" | undefined;
    }>>;
    review: z.ZodOptional<z.ZodObject<{
        requireHumanApproval: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        requireHumanApproval?: boolean | undefined;
    }, {
        requireHumanApproval?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    runtime?: {
        networkAccess?: "restricted" | "none" | undefined;
        domAccess?: "restricted" | "none" | undefined;
    } | undefined;
    imports?: {
        allow?: string[] | undefined;
        deny?: string[] | undefined;
    } | undefined;
    review?: {
        requireHumanApproval?: boolean | undefined;
    } | undefined;
}, {
    runtime?: {
        networkAccess?: "restricted" | "none" | undefined;
        domAccess?: "restricted" | "none" | undefined;
    } | undefined;
    imports?: {
        allow?: string[] | undefined;
        deny?: string[] | undefined;
    } | undefined;
    review?: {
        requireHumanApproval?: boolean | undefined;
    } | undefined;
}>;
export declare const ComponentSpecSchema: z.ZodObject<{
    apiVersion: z.ZodLiteral<"amaryllis/v1alpha1">;
    kind: z.ZodLiteral<"ComponentSpec">;
    metadata: z.ZodObject<{
        name: z.ZodString;
        version: z.ZodString;
        owner: z.ZodOptional<z.ZodString>;
        stability: z.ZodOptional<z.ZodEnum<["experimental", "stable", "deprecated"]>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        version: string;
        owner?: string | undefined;
        stability?: "experimental" | "stable" | "deprecated" | undefined;
    }, {
        name: string;
        version: string;
        owner?: string | undefined;
        stability?: "experimental" | "stable" | "deprecated" | undefined;
    }>;
    target: z.ZodObject<{
        framework: z.ZodLiteral<"react">;
        runtime: z.ZodEnum<["nextjs", "web", "rn"]>;
        ssr: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        framework: "react";
        runtime: "nextjs" | "web" | "rn";
        ssr?: boolean | undefined;
    }, {
        framework: "react";
        runtime: "nextjs" | "web" | "rn";
        ssr?: boolean | undefined;
    }>;
    props: z.ZodEffects<z.ZodObject<{
        type: z.ZodLiteral<"object">;
        properties: z.ZodRecord<z.ZodString, z.ZodType<any, z.ZodTypeDef, any>>;
        required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "object";
        properties: Record<string, any>;
        required?: string[] | undefined;
    }, {
        type: "object";
        properties: Record<string, any>;
        required?: string[] | undefined;
    }>, {
        type: "object";
        properties: Record<string, any>;
        required?: string[] | undefined;
    }, {
        type: "object";
        properties: Record<string, any>;
        required?: string[] | undefined;
    }>;
    ui: z.ZodOptional<z.ZodObject<{
        layout: z.ZodOptional<z.ZodString>;
        slots: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        variants: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            layout: z.ZodOptional<z.ZodString>;
            props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, "strip", z.ZodTypeAny, {
            layout?: string | undefined;
            props?: Record<string, unknown> | undefined;
        }, {
            layout?: string | undefined;
            props?: Record<string, unknown> | undefined;
        }>>>;
        designTokens: z.ZodOptional<z.ZodObject<{
            spacing: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            typography: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            colorRoles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            spacing?: string[] | undefined;
            typography?: string[] | undefined;
            colorRoles?: string[] | undefined;
        }, {
            spacing?: string[] | undefined;
            typography?: string[] | undefined;
            colorRoles?: string[] | undefined;
        }>>;
        accessibility: z.ZodOptional<z.ZodObject<{
            rules: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            rules?: string[] | undefined;
        }, {
            rules?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        layout?: string | undefined;
        slots?: string[] | undefined;
        variants?: Record<string, {
            layout?: string | undefined;
            props?: Record<string, unknown> | undefined;
        }> | undefined;
        designTokens?: {
            spacing?: string[] | undefined;
            typography?: string[] | undefined;
            colorRoles?: string[] | undefined;
        } | undefined;
        accessibility?: {
            rules?: string[] | undefined;
        } | undefined;
    }, {
        layout?: string | undefined;
        slots?: string[] | undefined;
        variants?: Record<string, {
            layout?: string | undefined;
            props?: Record<string, unknown> | undefined;
        }> | undefined;
        designTokens?: {
            spacing?: string[] | undefined;
            typography?: string[] | undefined;
            colorRoles?: string[] | undefined;
        } | undefined;
        accessibility?: {
            rules?: string[] | undefined;
        } | undefined;
    }>>;
    behavior: z.ZodOptional<z.ZodObject<{
        state: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        events: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        sideEffects: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        constraints: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        state?: Record<string, unknown> | undefined;
        events?: string[] | undefined;
        sideEffects?: string[] | undefined;
        constraints?: string[] | undefined;
    }, {
        state?: Record<string, unknown> | undefined;
        events?: string[] | undefined;
        sideEffects?: string[] | undefined;
        constraints?: string[] | undefined;
    }>>;
    ai: z.ZodEffects<z.ZodObject<{
        mode: z.ZodEnum<["scaffold", "customize", "personalize"]>;
        execution: z.ZodEnum<["build", "ci", "device"]>;
        allowedOperations: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        forbiddenOperations: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        generationContract: z.ZodOptional<z.ZodObject<{
            output: z.ZodEnum<["tsx", "props-json", "variant-selection", "json-patch"]>;
            schemaRef: z.ZodOptional<z.ZodString>;
            styleSystem: z.ZodOptional<z.ZodEnum<["tailwind", "css-modules"]>>;
            constraints: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            output: "tsx" | "props-json" | "variant-selection" | "json-patch";
            constraints?: string[] | undefined;
            schemaRef?: string | undefined;
            styleSystem?: "tailwind" | "css-modules" | undefined;
        }, {
            output: "tsx" | "props-json" | "variant-selection" | "json-patch";
            constraints?: string[] | undefined;
            schemaRef?: string | undefined;
            styleSystem?: "tailwind" | "css-modules" | undefined;
        }>>;
        validators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        mode: "scaffold" | "customize" | "personalize";
        execution: "build" | "ci" | "device";
        allowedOperations?: string[] | undefined;
        forbiddenOperations?: string[] | undefined;
        generationContract?: {
            output: "tsx" | "props-json" | "variant-selection" | "json-patch";
            constraints?: string[] | undefined;
            schemaRef?: string | undefined;
            styleSystem?: "tailwind" | "css-modules" | undefined;
        } | undefined;
        validators?: string[] | undefined;
    }, {
        mode: "scaffold" | "customize" | "personalize";
        execution: "build" | "ci" | "device";
        allowedOperations?: string[] | undefined;
        forbiddenOperations?: string[] | undefined;
        generationContract?: {
            output: "tsx" | "props-json" | "variant-selection" | "json-patch";
            constraints?: string[] | undefined;
            schemaRef?: string | undefined;
            styleSystem?: "tailwind" | "css-modules" | undefined;
        } | undefined;
        validators?: string[] | undefined;
    }>, {
        mode: "scaffold" | "customize" | "personalize";
        execution: "build" | "ci" | "device";
        allowedOperations?: string[] | undefined;
        forbiddenOperations?: string[] | undefined;
        generationContract?: {
            output: "tsx" | "props-json" | "variant-selection" | "json-patch";
            constraints?: string[] | undefined;
            schemaRef?: string | undefined;
            styleSystem?: "tailwind" | "css-modules" | undefined;
        } | undefined;
        validators?: string[] | undefined;
    }, {
        mode: "scaffold" | "customize" | "personalize";
        execution: "build" | "ci" | "device";
        allowedOperations?: string[] | undefined;
        forbiddenOperations?: string[] | undefined;
        generationContract?: {
            output: "tsx" | "props-json" | "variant-selection" | "json-patch";
            constraints?: string[] | undefined;
            schemaRef?: string | undefined;
            styleSystem?: "tailwind" | "css-modules" | undefined;
        } | undefined;
        validators?: string[] | undefined;
    }>;
    policy: z.ZodOptional<z.ZodObject<{
        imports: z.ZodOptional<z.ZodObject<{
            allow: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            deny: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
        }, {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
        }>>;
        runtime: z.ZodOptional<z.ZodObject<{
            networkAccess: z.ZodOptional<z.ZodEnum<["restricted", "none"]>>;
            domAccess: z.ZodOptional<z.ZodEnum<["restricted", "none"]>>;
        }, "strip", z.ZodTypeAny, {
            networkAccess?: "restricted" | "none" | undefined;
            domAccess?: "restricted" | "none" | undefined;
        }, {
            networkAccess?: "restricted" | "none" | undefined;
            domAccess?: "restricted" | "none" | undefined;
        }>>;
        review: z.ZodOptional<z.ZodObject<{
            requireHumanApproval: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            requireHumanApproval?: boolean | undefined;
        }, {
            requireHumanApproval?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        runtime?: {
            networkAccess?: "restricted" | "none" | undefined;
            domAccess?: "restricted" | "none" | undefined;
        } | undefined;
        imports?: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
        } | undefined;
        review?: {
            requireHumanApproval?: boolean | undefined;
        } | undefined;
    }, {
        runtime?: {
            networkAccess?: "restricted" | "none" | undefined;
            domAccess?: "restricted" | "none" | undefined;
        } | undefined;
        imports?: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
        } | undefined;
        review?: {
            requireHumanApproval?: boolean | undefined;
        } | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    props: {
        type: "object";
        properties: Record<string, any>;
        required?: string[] | undefined;
    };
    apiVersion: "amaryllis/v1alpha1";
    kind: "ComponentSpec";
    metadata: {
        name: string;
        version: string;
        owner?: string | undefined;
        stability?: "experimental" | "stable" | "deprecated" | undefined;
    };
    target: {
        framework: "react";
        runtime: "nextjs" | "web" | "rn";
        ssr?: boolean | undefined;
    };
    ai: {
        mode: "scaffold" | "customize" | "personalize";
        execution: "build" | "ci" | "device";
        allowedOperations?: string[] | undefined;
        forbiddenOperations?: string[] | undefined;
        generationContract?: {
            output: "tsx" | "props-json" | "variant-selection" | "json-patch";
            constraints?: string[] | undefined;
            schemaRef?: string | undefined;
            styleSystem?: "tailwind" | "css-modules" | undefined;
        } | undefined;
        validators?: string[] | undefined;
    };
    ui?: {
        layout?: string | undefined;
        slots?: string[] | undefined;
        variants?: Record<string, {
            layout?: string | undefined;
            props?: Record<string, unknown> | undefined;
        }> | undefined;
        designTokens?: {
            spacing?: string[] | undefined;
            typography?: string[] | undefined;
            colorRoles?: string[] | undefined;
        } | undefined;
        accessibility?: {
            rules?: string[] | undefined;
        } | undefined;
    } | undefined;
    behavior?: {
        state?: Record<string, unknown> | undefined;
        events?: string[] | undefined;
        sideEffects?: string[] | undefined;
        constraints?: string[] | undefined;
    } | undefined;
    policy?: {
        runtime?: {
            networkAccess?: "restricted" | "none" | undefined;
            domAccess?: "restricted" | "none" | undefined;
        } | undefined;
        imports?: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
        } | undefined;
        review?: {
            requireHumanApproval?: boolean | undefined;
        } | undefined;
    } | undefined;
}, {
    props: {
        type: "object";
        properties: Record<string, any>;
        required?: string[] | undefined;
    };
    apiVersion: "amaryllis/v1alpha1";
    kind: "ComponentSpec";
    metadata: {
        name: string;
        version: string;
        owner?: string | undefined;
        stability?: "experimental" | "stable" | "deprecated" | undefined;
    };
    target: {
        framework: "react";
        runtime: "nextjs" | "web" | "rn";
        ssr?: boolean | undefined;
    };
    ai: {
        mode: "scaffold" | "customize" | "personalize";
        execution: "build" | "ci" | "device";
        allowedOperations?: string[] | undefined;
        forbiddenOperations?: string[] | undefined;
        generationContract?: {
            output: "tsx" | "props-json" | "variant-selection" | "json-patch";
            constraints?: string[] | undefined;
            schemaRef?: string | undefined;
            styleSystem?: "tailwind" | "css-modules" | undefined;
        } | undefined;
        validators?: string[] | undefined;
    };
    ui?: {
        layout?: string | undefined;
        slots?: string[] | undefined;
        variants?: Record<string, {
            layout?: string | undefined;
            props?: Record<string, unknown> | undefined;
        }> | undefined;
        designTokens?: {
            spacing?: string[] | undefined;
            typography?: string[] | undefined;
            colorRoles?: string[] | undefined;
        } | undefined;
        accessibility?: {
            rules?: string[] | undefined;
        } | undefined;
    } | undefined;
    behavior?: {
        state?: Record<string, unknown> | undefined;
        events?: string[] | undefined;
        sideEffects?: string[] | undefined;
        constraints?: string[] | undefined;
    } | undefined;
    policy?: {
        runtime?: {
            networkAccess?: "restricted" | "none" | undefined;
            domAccess?: "restricted" | "none" | undefined;
        } | undefined;
        imports?: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
        } | undefined;
        review?: {
            requireHumanApproval?: boolean | undefined;
        } | undefined;
    } | undefined;
}>;
export type ValidatedComponentSpec = z.infer<typeof ComponentSpecSchema>;
