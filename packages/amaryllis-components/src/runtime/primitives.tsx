import React from 'react';

export interface UiPrimitiveProps {
  children?: React.ReactNode;
  style?: unknown;
}

export type UiPrimitiveComponent = React.ComponentType<UiPrimitiveProps>;

export interface UiPrimitives {
  View: UiPrimitiveComponent;
  Text: UiPrimitiveComponent;
}

const WebView: UiPrimitiveComponent = ({ children, style }) =>
  React.createElement(
    'div',
    { style: style as React.CSSProperties | undefined },
    children
  );

const WebText: UiPrimitiveComponent = ({ children, style }) =>
  React.createElement(
    'span',
    { style: style as React.CSSProperties | undefined },
    children
  );

export const defaultUiPrimitives: UiPrimitives = {
  View: WebView,
  Text: WebText,
};

export function resolveUiPrimitives(
  primitives?: Partial<UiPrimitives>
): UiPrimitives {
  return {
    ...defaultUiPrimitives,
    ...primitives,
  };
}
