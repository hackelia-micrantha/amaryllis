import { z } from 'zod';
import type { JsonSchemaValue } from '../types/spec';
export declare const StabilitySchema: z.ZodEnum<{
    experimental: "experimental";
    stable: "stable";
    deprecated: "deprecated";
}>;
export declare const JsonSchemaValueSchema: z.ZodType<JsonSchemaValue>;
export declare const ComponentMetadataSchema: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodString;
    owner: z.ZodOptional<z.ZodString>;
    stability: z.ZodOptional<z.ZodEnum<{
        experimental: "experimental";
        stable: "stable";
        deprecated: "deprecated";
    }>>;
}, z.core.$strip>;
export declare const ComponentTargetSchema: z.ZodObject<{
    framework: z.ZodLiteral<"react">;
    runtime: z.ZodEnum<{
        nextjs: "nextjs";
        web: "web";
        rn: "rn";
    }>;
    ssr: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const ComponentPropsSchema: z.ZodObject<{
    type: z.ZodLiteral<"object">;
    properties: z.ZodRecord<z.ZodString, z.ZodType<JsonSchemaValue, unknown, z.core.$ZodTypeInternals<JsonSchemaValue, unknown>>>;
    required: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const ComponentUISchema: z.ZodObject<{
    layout: z.ZodOptional<z.ZodString>;
    slots: z.ZodOptional<z.ZodArray<z.ZodString>>;
    variants: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        layout: z.ZodOptional<z.ZodString>;
        props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>>;
    designTokens: z.ZodOptional<z.ZodObject<{
        spacing: z.ZodOptional<z.ZodArray<z.ZodString>>;
        typography: z.ZodOptional<z.ZodArray<z.ZodString>>;
        colorRoles: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    accessibility: z.ZodOptional<z.ZodObject<{
        rules: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ComponentBehaviorSchema: z.ZodObject<{
    state: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    events: z.ZodOptional<z.ZodArray<z.ZodString>>;
    sideEffects: z.ZodOptional<z.ZodArray<z.ZodString>>;
    constraints: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const AIExecutionModeSchema: z.ZodEnum<{
    scaffold: "scaffold";
    customize: "customize";
    personalize: "personalize";
}>;
export declare const AIExecutionEnvironmentSchema: z.ZodEnum<{
    build: "build";
    ci: "ci";
    device: "device";
}>;
export declare const ComponentAISchema: z.ZodObject<{
    mode: z.ZodEnum<{
        scaffold: "scaffold";
        customize: "customize";
        personalize: "personalize";
    }>;
    execution: z.ZodEnum<{
        build: "build";
        ci: "ci";
        device: "device";
    }>;
    allowedOperations: z.ZodOptional<z.ZodArray<z.ZodString>>;
    forbiddenOperations: z.ZodOptional<z.ZodArray<z.ZodString>>;
    generationContract: z.ZodOptional<z.ZodObject<{
        output: z.ZodEnum<{
            tsx: "tsx";
            "props-json": "props-json";
            "variant-selection": "variant-selection";
            "json-patch": "json-patch";
        }>;
        schemaRef: z.ZodOptional<z.ZodString>;
        styleSystem: z.ZodOptional<z.ZodEnum<{
            tailwind: "tailwind";
            "css-modules": "css-modules";
        }>>;
        constraints: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    validators: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const ComponentPolicySchema: z.ZodObject<{
    imports: z.ZodOptional<z.ZodObject<{
        allow: z.ZodOptional<z.ZodArray<z.ZodString>>;
        deny: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    runtime: z.ZodOptional<z.ZodObject<{
        networkAccess: z.ZodOptional<z.ZodEnum<{
            restricted: "restricted";
            none: "none";
        }>>;
        domAccess: z.ZodOptional<z.ZodEnum<{
            restricted: "restricted";
            none: "none";
        }>>;
    }, z.core.$strip>>;
    review: z.ZodOptional<z.ZodObject<{
        requireHumanApproval: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ComponentSpecSchema: z.ZodObject<{
    apiVersion: z.ZodLiteral<"amaryllis/v1alpha1">;
    kind: z.ZodLiteral<"ComponentSpec">;
    metadata: z.ZodObject<{
        name: z.ZodString;
        version: z.ZodString;
        owner: z.ZodOptional<z.ZodString>;
        stability: z.ZodOptional<z.ZodEnum<{
            experimental: "experimental";
            stable: "stable";
            deprecated: "deprecated";
        }>>;
    }, z.core.$strip>;
    target: z.ZodObject<{
        framework: z.ZodLiteral<"react">;
        runtime: z.ZodEnum<{
            nextjs: "nextjs";
            web: "web";
            rn: "rn";
        }>;
        ssr: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>;
    props: z.ZodObject<{
        type: z.ZodLiteral<"object">;
        properties: z.ZodRecord<z.ZodString, z.ZodType<JsonSchemaValue, unknown, z.core.$ZodTypeInternals<JsonSchemaValue, unknown>>>;
        required: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    ui: z.ZodOptional<z.ZodObject<{
        layout: z.ZodOptional<z.ZodString>;
        slots: z.ZodOptional<z.ZodArray<z.ZodString>>;
        variants: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            layout: z.ZodOptional<z.ZodString>;
            props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>>;
        designTokens: z.ZodOptional<z.ZodObject<{
            spacing: z.ZodOptional<z.ZodArray<z.ZodString>>;
            typography: z.ZodOptional<z.ZodArray<z.ZodString>>;
            colorRoles: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        accessibility: z.ZodOptional<z.ZodObject<{
            rules: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    behavior: z.ZodOptional<z.ZodObject<{
        state: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        events: z.ZodOptional<z.ZodArray<z.ZodString>>;
        sideEffects: z.ZodOptional<z.ZodArray<z.ZodString>>;
        constraints: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    ai: z.ZodObject<{
        mode: z.ZodEnum<{
            scaffold: "scaffold";
            customize: "customize";
            personalize: "personalize";
        }>;
        execution: z.ZodEnum<{
            build: "build";
            ci: "ci";
            device: "device";
        }>;
        allowedOperations: z.ZodOptional<z.ZodArray<z.ZodString>>;
        forbiddenOperations: z.ZodOptional<z.ZodArray<z.ZodString>>;
        generationContract: z.ZodOptional<z.ZodObject<{
            output: z.ZodEnum<{
                tsx: "tsx";
                "props-json": "props-json";
                "variant-selection": "variant-selection";
                "json-patch": "json-patch";
            }>;
            schemaRef: z.ZodOptional<z.ZodString>;
            styleSystem: z.ZodOptional<z.ZodEnum<{
                tailwind: "tailwind";
                "css-modules": "css-modules";
            }>>;
            constraints: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        validators: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    policy: z.ZodOptional<z.ZodObject<{
        imports: z.ZodOptional<z.ZodObject<{
            allow: z.ZodOptional<z.ZodArray<z.ZodString>>;
            deny: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        runtime: z.ZodOptional<z.ZodObject<{
            networkAccess: z.ZodOptional<z.ZodEnum<{
                restricted: "restricted";
                none: "none";
            }>>;
            domAccess: z.ZodOptional<z.ZodEnum<{
                restricted: "restricted";
                none: "none";
            }>>;
        }, z.core.$strip>>;
        review: z.ZodOptional<z.ZodObject<{
            requireHumanApproval: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ValidatedComponentSpec = z.infer<typeof ComponentSpecSchema>;
