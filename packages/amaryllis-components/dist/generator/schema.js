"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONSchemaGenerator = void 0;
class JSONSchemaGenerator {
    generate(spec) {
        const { metadata, props, ui } = spec;
        const schema = {
            $schema: 'http://json-schema.org/draft-07/schema#',
            title: `${metadata.name} Personalization Contract`,
            description: `Schema for on-device personalization of ${metadata.name} v${metadata.version}`,
            type: 'object',
            properties: {
                props: {
                    type: 'object',
                    properties: this.mapProperties(props.properties),
                    required: props.required || [],
                    additionalProperties: false,
                },
                variant: ui?.variants
                    ? {
                        type: 'string',
                        enum: Object.keys(ui.variants),
                    }
                    : undefined,
                slots: ui?.slots
                    ? {
                        type: 'object',
                        properties: ui.slots.reduce((acc, slot) => {
                            acc[slot] = { type: 'string' };
                            return acc;
                        }, {}),
                        additionalProperties: false,
                    }
                    : undefined,
                designTokens: ui?.designTokens
                    ? {
                        type: 'object',
                        properties: this.mapDesignTokens(ui.designTokens),
                        additionalProperties: false,
                    }
                    : undefined,
                patches: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            op: {
                                type: 'string',
                                enum: ['add', 'remove', 'replace', 'move', 'copy', 'test'],
                            },
                            path: { type: 'string' },
                            from: { type: 'string' },
                            value: {},
                        },
                        required: ['op', 'path'],
                        additionalProperties: false,
                    },
                },
            },
            additionalProperties: false,
        };
        return JSON.stringify(schema, null, 2);
    }
    mapProperties(properties) {
        const mapped = {};
        for (const [key, value] of Object.entries(properties)) {
            mapped[key] = this.mapProperty(value);
        }
        return mapped;
    }
    mapProperty(value) {
        return {
            ...(value.type && { type: value.type }),
            ...(value.description && { description: value.description }),
            ...(value.enum && { enum: value.enum }),
            ...(value.default !== undefined && { default: value.default }),
            ...(value.items && { items: this.mapProperty(value.items) }),
            ...(value.properties && {
                properties: this.mapProperties(value.properties),
            }),
            ...(value.required && { required: value.required }),
            ...(value.additionalProperties !== undefined && {
                additionalProperties: typeof value.additionalProperties === 'boolean'
                    ? value.additionalProperties
                    : this.mapProperty(value.additionalProperties),
            }),
        };
    }
    mapDesignTokens(designTokens) {
        const mapped = {};
        for (const role of [
            ...(designTokens?.spacing ?? []),
            ...(designTokens?.typography ?? []),
            ...(designTokens?.colorRoles ?? []),
        ]) {
            mapped[role] = { type: 'string' };
        }
        return mapped;
    }
}
exports.JSONSchemaGenerator = JSONSchemaGenerator;
