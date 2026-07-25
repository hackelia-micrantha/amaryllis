import React from 'react';
import { Text as NativeText, View as NativeView } from 'react-native';

export interface UiPrimitiveProps {
  children?: React.ReactNode;
  style?: unknown;
}

export type UiPrimitiveComponent = React.ComponentType<any>;

export interface UiPrimitives {
  View: UiPrimitiveComponent;
  Text: UiPrimitiveComponent;
}

export const defaultUiPrimitives: UiPrimitives = {
  View: NativeView,
  Text: NativeText,
};

export function resolveUiPrimitives(
  primitives?: Partial<UiPrimitives>
): UiPrimitives {
  return {
    ...defaultUiPrimitives,
    ...primitives,
  };
}
