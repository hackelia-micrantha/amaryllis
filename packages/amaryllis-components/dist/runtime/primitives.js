"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultUiPrimitives = void 0;
exports.resolveUiPrimitives = resolveUiPrimitives;
const react_native_1 = require("react-native");
exports.defaultUiPrimitives = {
    View: react_native_1.View,
    Text: react_native_1.Text,
};
function resolveUiPrimitives(primitives) {
    return {
        ...exports.defaultUiPrimitives,
        ...primitives,
    };
}
