"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultUiPrimitives = void 0;
exports.resolveUiPrimitives = resolveUiPrimitives;
const react_1 = __importDefault(require("react"));
const WebView = ({ children, style }) => react_1.default.createElement('div', { style: style }, children);
const WebText = ({ children, style }) => react_1.default.createElement('span', { style: style }, children);
exports.defaultUiPrimitives = {
    View: WebView,
    Text: WebText,
};
function resolveUiPrimitives(primitives) {
    return {
        ...exports.defaultUiPrimitives,
        ...primitives,
    };
}
