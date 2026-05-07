"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonalizationEngine = void 0;
const ajv_1 = __importDefault(require("ajv"));
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
        return {
            valid: true,
            data: aiOutput,
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
        return result;
    }
}
exports.PersonalizationEngine = PersonalizationEngine;
