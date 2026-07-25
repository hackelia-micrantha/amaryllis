"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComponentRegistry = exports.hashRegistryValue = void 0;
exports.stableStringify = stableStringify;
exports.fnv1aHash = fnv1aHash;
exports.getRegistryKey = getRegistryKey;
exports.createRegistryIdentity = createRegistryIdentity;
function stableStringify(value) {
    if (value === undefined) {
        return 'undefined';
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        const record = value;
        return `{${Object.keys(record)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
            .join(',')}}`;
    }
    return JSON.stringify(value);
}
function fnv1aHash(value) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}
const hashRegistryValue = (value, hash = fnv1aHash) => {
    return hash(stableStringify(value));
};
exports.hashRegistryValue = hashRegistryValue;
function getRegistryKey(componentName, version) {
    return `${componentName}@${version}`;
}
function createRegistryIdentity(entry, hash = fnv1aHash) {
    const componentName = entry.spec.metadata.name;
    const version = entry.spec.metadata.version;
    return {
        key: getRegistryKey(componentName, version),
        componentName,
        version,
        specHash: (0, exports.hashRegistryValue)(entry.spec, hash),
        runtimeContractHash: (0, exports.hashRegistryValue)(entry.contract, hash),
        implementationIdentity: entry.implementationIdentity ??
            `${componentName}@${version}:implementation`,
    };
}
class ComponentRegistry {
    components = new Map();
    latestByName = new Map();
    hash;
    constructor(options = {}) {
        this.hash = options.hash ?? fnv1aHash;
    }
    register(name, entry, options = {}) {
        const identity = createRegistryIdentity(entry, this.hash);
        this.assertRegistrationMatches(name, entry, identity);
        if (!options.replace && this.components.has(identity.key)) {
            throw new Error(`Component ${identity.key} is already registered. Pass { replace: true } to replace it.`);
        }
        this.components.set(identity.key, {
            ...entry,
            ...identity,
        });
        this.updateLatest(identity.componentName);
    }
    get(name) {
        return this.components.get(name) ?? this.getLatestByComponentName(name);
    }
    list() {
        return Array.from(this.components.keys());
    }
    snapshot() {
        return Array.from(this.components.values()).map((entry) => ({
            key: entry.key,
            componentName: entry.componentName,
            version: entry.version,
            specHash: entry.specHash,
            runtimeContractHash: entry.runtimeContractHash,
            implementationIdentity: entry.implementationIdentity,
            spec: entry.spec,
            contract: entry.contract,
        }));
    }
    hydrate(entries, resolveComponent, options = {}) {
        entries.forEach((entry) => {
            this.register(entry.key, {
                ...entry,
                component: resolveComponent(entry),
            }, options);
        });
    }
    assertRegistrationMatches(name, entry, identity) {
        if (name.includes('@') && name !== identity.key) {
            throw new Error('registry key does not match spec metadata');
        }
        if (!name.includes('@') && name !== identity.componentName) {
            throw new Error('name does not match spec.metadata.name');
        }
        if (entry.componentName !== undefined &&
            entry.componentName !== identity.componentName) {
            throw new Error('componentName does not match spec.metadata.name');
        }
        if (entry.version !== undefined && entry.version !== identity.version) {
            throw new Error('version does not match spec.metadata.version');
        }
        if (entry.specHash !== undefined && entry.specHash !== identity.specHash) {
            throw new Error('specHash does not match spec');
        }
        if (entry.runtimeContractHash !== undefined &&
            entry.runtimeContractHash !== identity.runtimeContractHash) {
            throw new Error('runtimeContractHash does not match contract');
        }
    }
    getLatestByComponentName(componentName) {
        const key = this.latestByName.get(componentName);
        return key ? this.components.get(key) : undefined;
    }
    updateLatest(componentName) {
        const keys = Array.from(this.components.keys()).filter((key) => key.startsWith(`${componentName}@`));
        const latest = keys.sort(compareRegistryKeys).at(-1);
        if (latest) {
            this.latestByName.set(componentName, latest);
        }
    }
}
exports.ComponentRegistry = ComponentRegistry;
function compareRegistryKeys(left, right) {
    const leftVersion = left.slice(left.lastIndexOf('@') + 1);
    const rightVersion = right.slice(right.lastIndexOf('@') + 1);
    return leftVersion.localeCompare(rightVersion, undefined, { numeric: true });
}
