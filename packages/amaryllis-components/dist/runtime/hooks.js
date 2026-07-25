"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePersonalization = usePersonalization;
exports.createAmaryllisInferenceAdapter = createAmaryllisInferenceAdapter;
exports.createAmaryllisInferencePersonalizationAction = createAmaryllisInferencePersonalizationAction;
exports.createAmaryllisPersonalizationAction = createAmaryllisPersonalizationAction;
exports.useAmaryllisPersonalizationAction = useAmaryllisPersonalizationAction;
const react_1 = require("react");
const engine_1 = require("./engine");
const registryContext_1 = require("./registryContext");
function usePersonalization({ name, baseProps = {}, }) {
    const engine = (0, react_1.useMemo)(() => new engine_1.PersonalizationEngine(), []);
    const [personalizedProps, setPersonalizedProps] = (0, react_1.useState)(baseProps);
    const [error, setError] = (0, react_1.useState)(null);
    const registry = (0, registryContext_1.useRegistry)();
    const applyPersonalization = (0, react_1.useCallback)((aiOutput) => {
        const registered = registry.get(name);
        if (!registered) {
            setError([`Component ${name} not registered`]);
            return;
        }
        const result = engine.validate(registered.contract, aiOutput);
        if (result.valid) {
            setPersonalizedProps(engine.apply(baseProps, result.data ?? {}));
            setError(null);
        }
        else {
            setError(result.errors || ['Unknown validation error']);
        }
    }, [registry, name, engine, baseProps]);
    const reset = (0, react_1.useCallback)(() => {
        setPersonalizedProps(baseProps);
        setError(null);
    }, [baseProps]);
    return {
        personalizedProps,
        error,
        applyPersonalization,
        reset,
    };
}
function createAmaryllisInferenceAdapter(generate) {
    return async ({ prompt }) => {
        const output = await generate({ prompt });
        return parseAmaryllisInferenceOutput(output);
    };
}
function createAmaryllisInferencePersonalizationAction({ componentName, baseProps = {}, generate, recovery, registry, }) {
    return createAmaryllisPersonalizationAction({
        componentName,
        baseProps,
        infer: createAmaryllisInferenceAdapter(generate),
        recovery,
        registry,
    });
}
function createAmaryllisPersonalizationAction({ componentName, baseProps = {}, infer, recovery, registry, }) {
    const engine = new engine_1.PersonalizationEngine();
    const maxRecoveryAttempts = Math.max(0, recovery?.maxAttempts ?? 0);
    return async (request) => {
        const props = request.baseProps ?? baseProps;
        const registered = registry.get(componentName);
        if (!registered) {
            return {
                valid: false,
                props,
                errors: [`Component ${componentName} is not registered`],
            };
        }
        let rawOutput = await infer({
            componentName,
            baseProps: props,
            prompt: request.prompt,
            context: request.context,
        });
        let result = engine.validate(registered.contract, rawOutput);
        for (let attempt = 1; !result.valid && attempt <= maxRecoveryAttempts; attempt++) {
            rawOutput = await infer({
                componentName,
                baseProps: props,
                prompt: request.prompt,
                context: request.context,
                recovery: {
                    attempt,
                    validationErrors: result.errors ?? ['Unknown validation error'],
                    rawOutput,
                },
            });
            result = engine.validate(registered.contract, rawOutput);
        }
        if (!result.valid) {
            return {
                valid: false,
                props,
                errors: result.errors ?? ['Unknown validation error'],
                rawOutput,
            };
        }
        return {
            valid: true,
            props: engine.apply(props, result.data ?? {}),
            rawOutput,
        };
    };
}
function useAmaryllisPersonalizationAction(options) {
    const { componentName, baseProps, infer, recovery } = options;
    const registry = (0, registryContext_1.useRegistry)();
    return (0, react_1.useMemo)(() => createAmaryllisPersonalizationAction({
        componentName,
        baseProps,
        infer,
        recovery,
        registry,
    }), [componentName, baseProps, infer, recovery, registry]);
}
function parseAmaryllisInferenceOutput(output) {
    if (typeof output !== 'string') {
        return output;
    }
    try {
        return JSON.parse(output);
    }
    catch {
        return output;
    }
}
