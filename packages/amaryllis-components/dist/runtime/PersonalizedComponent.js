"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonalizedComponent = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const engine_1 = require("./engine");
const primitives_1 = require("./primitives");
const registryContext_1 = require("./registryContext");
const EMPTY_PROPS = Object.freeze({});
/**
 * A wrapper component that handles on-device personalization.
 * It validates AI output against the component's contract before rendering.
 */
const PersonalizedComponent = ({ name, baseProps = EMPTY_PROPS, personalizationData, loading, fallback, primitives, onValidation, warnOnValidationFailure = false, }) => {
    const registry = (0, registryContext_1.useRegistry)();
    const registered = registry.get(name);
    const engine = (0, react_1.useMemo)(() => new engine_1.PersonalizationEngine(), []);
    const { View, Text } = (0, react_1.useMemo)(() => (0, primitives_1.resolveUiPrimitives)(primitives), [primitives]);
    // Derived render state must be computed from current inputs, not restored in
    // a passive effect after a previous component/audience has already rendered.
    const validation = (0, react_1.useMemo)(() => {
        if (!registered || !personalizationData)
            return null;
        return engine.validate(registered.contract, personalizationData);
    }, [registered, personalizationData, engine]);
    const finalProps = (0, react_1.useMemo)(() => {
        if (!validation?.valid)
            return baseProps;
        return engine.apply(baseProps, validation.data ?? {});
    }, [baseProps, validation, engine]);
    const error = validation && !validation.valid ? 'Invalid personalization data' : null;
    (0, react_1.useEffect)(() => {
        if (!validation)
            return;
        onValidation?.({
            name,
            valid: validation.valid,
            errors: validation.errors,
            diagnostics: validation.diagnostics,
        });
        if (!validation.valid && warnOnValidationFailure) {
            console.warn(`Personalization validation failed for ${name}:`, validation.errors);
        }
    }, [name, validation, onValidation, warnOnValidationFailure]);
    if (!registered) {
        return (0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: fallback || null });
    }
    const Component = registered.component;
    if (loading) {
        // Render with base props while loading, or could render a dedicated loader
        return (0, jsx_runtime_1.jsx)(Component, { ...baseProps, _loading: true });
    }
    return ((0, jsx_runtime_1.jsxs)(View, { children: [(0, jsx_runtime_1.jsx)(Component, { ...finalProps }), error && (0, jsx_runtime_1.jsx)(Text, { style: styles.errorText, children: error })] }));
};
exports.PersonalizedComponent = PersonalizedComponent;
const styles = {
    errorText: {
        color: 'red',
        fontSize: 10,
    },
};
