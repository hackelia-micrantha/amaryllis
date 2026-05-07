"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentUIAdapter = void 0;
exports.createAgentUIToolContract = createAgentUIToolContract;
function createAgentUIToolContract(componentName, entry) {
    if (!entry) {
        throw new Error(`Component ${componentName} is not registered.`);
    }
    const { spec, contract } = entry;
    const name = spec.metadata.name;
    const version = spec.metadata.version;
    return {
        name: `amaryllis.personalize.${name}`,
        description: `Personalize ${name}@${version} with structured output only. ` +
            'Do not return JSX, TSX, JavaScript, imports, or raw markup.',
        parameters: {
            type: 'object',
            properties: {
                prompt: { type: 'string' },
                context: {
                    type: 'object',
                    additionalProperties: true,
                },
            },
            required: ['prompt'],
            additionalProperties: false,
        },
        component: {
            name,
            version,
            contract,
        },
    };
}
exports.agentUIAdapter = {
    createToolContract: createAgentUIToolContract,
};
