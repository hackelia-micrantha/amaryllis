"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalRegistry = exports.ComponentRegistry = void 0;
class ComponentRegistry {
    components = new Map();
    register(name, entry) {
        this.components.set(name, entry);
    }
    get(name) {
        return this.components.get(name);
    }
    list() {
        return Array.from(this.components.keys());
    }
}
exports.ComponentRegistry = ComponentRegistry;
// Global registry instance
exports.globalRegistry = new ComponentRegistry();
