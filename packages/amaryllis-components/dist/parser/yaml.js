"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseComponentSpec = parseComponentSpec;
exports.stringifyComponentSpec = stringifyComponentSpec;
const js_yaml_1 = __importDefault(require("js-yaml"));
const spec_schema_1 = require("../schema/spec.schema");
function parseComponentSpec(content) {
    const raw = js_yaml_1.default.load(content);
    return spec_schema_1.ComponentSpecSchema.parse(raw);
}
function stringifyComponentSpec(spec) {
    return js_yaml_1.default.dump(spec);
}
