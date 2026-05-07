"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonalizationEngine = void 0;
const ajv_1 = __importDefault(require("ajv"));
const jsonpatch = __importStar(require("fast-json-patch"));
class PersonalizationEngine {
    ajv;
    constructor() {
        this.ajv = new ajv_1.default({ allErrors: true, useDefaults: true });
    }
    validate(contract, aiOutput) {
        const validate = this.ajv.compile(contract);
        const valid = validate(aiOutput);
        if (!valid) {
            return {
                valid: false,
                errors: validate.errors?.map((err) => `${err.instancePath || err.schemaPath} ${err.message}`),
            };
        }
        const patchResult = this.applyValidatedPatches(contract, aiOutput);
        if (!patchResult.valid) {
            return patchResult;
        }
        return {
            valid: true,
            data: patchResult.data,
        };
    }
    /**
     * Applies the validated personalization data to the base props.
     */
    apply(baseProps, personalization) {
        const result = { ...baseProps };
        if (personalization.props) {
            Object.assign(result, personalization.props);
        }
        if (personalization.variant) {
            result.variant = personalization.variant;
        }
        if (personalization.slots) {
            Object.assign(result, personalization.slots);
        }
        if (personalization.designTokens) {
            result.designTokens = personalization.designTokens;
        }
        return result;
    }
    applyValidatedPatches(contract, aiOutput) {
        const personalization = aiOutput;
        if (!personalization.patches || personalization.patches.length === 0) {
            return {
                valid: true,
                data: personalization,
            };
        }
        const pathErrors = this.validatePatchPaths(contract, personalization.patches);
        if (pathErrors.length > 0) {
            return {
                valid: false,
                errors: pathErrors,
            };
        }
        try {
            const overlay = this.createPatchOverlay(personalization);
            const patched = jsonpatch.applyPatch(overlay, personalization.patches, true, false).newDocument;
            const patchedData = this.stripEmptyOverlayContainers(patched);
            const validationErrors = this.validatePatchedData(contract, patchedData);
            if (validationErrors.length > 0) {
                return {
                    valid: false,
                    errors: validationErrors,
                };
            }
            return {
                valid: true,
                data: patchedData,
            };
        }
        catch (err) {
            return {
                valid: false,
                errors: [
                    err instanceof Error
                        ? `Invalid personalization patch: ${err.message}`
                        : 'Invalid personalization patch',
                ],
            };
        }
    }
    validatePatchPaths(contract, patches) {
        const errors = [];
        patches.forEach((patch, index) => {
            if (!this.isAllowedPatchPath(contract, patch.path)) {
                errors.push(`/patches/${index}/path must target a declared personalization path`);
            }
            if ('from' in patch &&
                typeof patch.from === 'string' &&
                !this.isAllowedPatchPath(contract, patch.from)) {
                errors.push(`/patches/${index}/from must target a declared personalization path`);
            }
        });
        return errors;
    }
    isAllowedPatchPath(contract, path) {
        const segments = this.parseJsonPointer(path);
        if (!segments) {
            return false;
        }
        if (segments.length === 1) {
            return segments[0] === 'variant';
        }
        if (segments.length !== 2) {
            return false;
        }
        const [section, name] = segments;
        if (!name) {
            return false;
        }
        if (section === 'props') {
            return this.hasDeclaredProperty(contract, ['props'], name);
        }
        if (section === 'slots') {
            return this.hasDeclaredProperty(contract, ['slots'], name);
        }
        if (section === 'designTokens') {
            return this.hasDeclaredProperty(contract, ['designTokens'], name);
        }
        return false;
    }
    parseJsonPointer(path) {
        if (path === '' || !path.startsWith('/')) {
            return null;
        }
        return path
            .slice(1)
            .split('/')
            .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
    }
    hasDeclaredProperty(contract, path, name) {
        const schema = path.reduce((current, segment) => {
            if (!this.isRecord(current)) {
                return undefined;
            }
            const properties = current.properties;
            if (!this.isRecord(properties)) {
                return undefined;
            }
            return properties[segment];
        }, contract);
        if (!this.isRecord(schema) || !this.isRecord(schema.properties)) {
            return false;
        }
        return Object.prototype.hasOwnProperty.call(schema.properties, name);
    }
    createPatchOverlay(personalization) {
        return {
            props: { ...(personalization.props ?? {}) },
            ...(personalization.variant && { variant: personalization.variant }),
            slots: { ...(personalization.slots ?? {}) },
            designTokens: { ...(personalization.designTokens ?? {}) },
        };
    }
    stripEmptyOverlayContainers(personalization) {
        const data = {};
        if (personalization.props &&
            Object.keys(personalization.props).length > 0) {
            data.props = personalization.props;
        }
        if (personalization.variant) {
            data.variant = personalization.variant;
        }
        if (personalization.slots &&
            Object.keys(personalization.slots).length > 0) {
            data.slots = personalization.slots;
        }
        if (personalization.designTokens &&
            Object.keys(personalization.designTokens).length > 0) {
            data.designTokens = personalization.designTokens;
        }
        return data;
    }
    validatePatchedData(contract, data) {
        const validate = this.ajv.compile(contract);
        const valid = validate(data);
        if (valid) {
            return [];
        }
        return (validate.errors?.map((err) => `${err.instancePath || err.schemaPath} ${err.message}`) ?? ['Patched personalization data failed validation']);
    }
    isRecord(value) {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
}
exports.PersonalizationEngine = PersonalizationEngine;
