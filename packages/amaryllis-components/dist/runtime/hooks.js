"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePersonalization = usePersonalization;
exports.createAmaryllisInferenceAdapter = createAmaryllisInferenceAdapter;
exports.createAmaryllisInferencePersonalizationAction = createAmaryllisInferencePersonalizationAction;
exports.createAmaryllisPersonalizationAction = createAmaryllisPersonalizationAction;
exports.useAmaryllisPersonalizationAction = useAmaryllisPersonalizationAction;
const react_1 = require("react");
const engine_1 = require("./engine");
const registry_1 = require("./registry");
function usePersonalization({ name, baseProps = {}, }) {
    const engine = (0, react_1.useMemo)(() => new engine_1.PersonalizationEngine(), []);
    const [personalizedProps, setPersonalizedProps] = (0, react_1.useState)(baseProps);
    const [error, setError] = (0, react_1.useState)(null);
    const applyPersonalization = (0, react_1.useCallback)((aiOutput) => {
        const registered = registry_1.globalRegistry.get(name);
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
    }, [name, baseProps, engine]);
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
function createAmaryllisInferencePersonalizationAction({ componentName, baseProps = {}, generate, }) {
    return createAmaryllisPersonalizationAction({
        componentName,
        baseProps,
        infer: createAmaryllisInferenceAdapter(generate),
    });
}
function createAmaryllisPersonalizationAction({ componentName, baseProps = {}, infer, }) {
    const engine = new engine_1.PersonalizationEngine();
    return async (request) => {
        const props = request.baseProps ?? baseProps;
        const registered = registry_1.globalRegistry.get(componentName);
        if (!registered) {
            return {
                valid: false,
                props,
                errors: [`Component ${componentName} is not registered`],
            };
        }
        const rawOutput = await infer({
            componentName,
            baseProps: props,
            prompt: request.prompt,
            context: request.context,
        });
        const result = engine.validate(registered.contract, rawOutput);
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
    const { componentName, baseProps, infer } = options;
    return (0, react_1.useMemo)(() => createAmaryllisPersonalizationAction({
        componentName,
        baseProps,
        infer,
    }), [componentName, baseProps, infer]);
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
