"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonalizedComponent = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const registry_1 = require("./registry");
const engine_1 = require("./engine");
const primitives_1 = require("./primitives");
/**
 * A wrapper component that handles on-device personalization.
 * It validates AI output against the component's contract before rendering.
 */
const PersonalizedComponent = ({ name, baseProps = {}, personalizationData, loading, fallback, primitives, }) => {
    const registered = registry_1.globalRegistry.get(name);
    const engine = (0, react_1.useMemo)(() => new engine_1.PersonalizationEngine(), []);
    const { View, Text } = (0, react_1.useMemo)(() => (0, primitives_1.resolveUiPrimitives)(primitives), [primitives]);
    const [finalProps, setFinalProps] = (0, react_1.useState)(baseProps);
    const [error, setError] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        if (!registered)
            return;
        if (personalizationData) {
            const result = engine.validate(registered.contract, personalizationData);
            if (result.valid) {
                setFinalProps(engine.apply(baseProps, result.data ?? {}));
                setError(null);
            }
            else {
                console.warn(`Personalization validation failed for ${name}:`, result.errors);
                setError('Invalid personalization data');
                // Revert to base props on failure
                setFinalProps(baseProps);
            }
        }
        else {
            setFinalProps(baseProps);
        }
    }, [name, personalizationData, baseProps, registered, engine]);
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
