import React from 'react';
export interface UiPrimitiveProps {
    children?: React.ReactNode;
    style?: unknown;
}
export type UiPrimitiveComponent = React.ComponentType<any>;
export interface UiPrimitives {
    View: UiPrimitiveComponent;
    Text: UiPrimitiveComponent;
}
export declare const defaultUiPrimitives: UiPrimitives;
export declare function resolveUiPrimitives(primitives?: Partial<UiPrimitives>): UiPrimitives;
