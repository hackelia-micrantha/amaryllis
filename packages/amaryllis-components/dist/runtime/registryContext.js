"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useRegistry = useRegistry;
exports.RegistryProvider = RegistryProvider;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const registry_1 = require("./registry");
const RegistryContext = (0, react_1.createContext)(null);
function useRegistry() {
    const registry = (0, react_1.useContext)(RegistryContext);
    if (!registry) {
        throw new Error('ComponentRegistry not found in context');
    }
    return registry;
}
function RegistryProvider({ hash = registry_1.fnv1aHash, initialize, children, }) {
    const registry = (0, react_1.useMemo)(() => {
        const nextRegistry = new registry_1.ComponentRegistry({ hash });
        initialize?.(nextRegistry);
        return nextRegistry;
    }, [hash, initialize]);
    return ((0, jsx_runtime_1.jsx)(RegistryContext.Provider, { value: registry, children: children }));
}
