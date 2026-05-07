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
            },
            additionalProperties: false,
        };
        return JSON.stringify(schema, null, 2);
    }
    mapProperties(properties) {
        const mapped = {};
        for (const [key, value] of Object.entries(properties)) {
            mapped[key] = {
                type: value.type,
                ...(value.description && { description: value.description }),
                ...(value.enum && { enum: value.enum }),
                ...(value.default !== undefined && { default: value.default }),
            };
        }
        return mapped;
    }
}
exports.JSONSchemaGenerator = JSONSchemaGenerator;
