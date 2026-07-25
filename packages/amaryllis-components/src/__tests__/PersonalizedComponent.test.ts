import React from 'react';
import type { ComponentType } from 'react';
import type { ValidatedComponentSpec } from '../schema/spec.schema';

import { JSONSchemaGenerator } from '../generator/schema';
import { PersonalizedComponent } from '../runtime/PersonalizedComponent';
import { resolveUiPrimitives } from '../runtime/primitives';
import { RegistryProvider } from '../runtime/registryContext';

jest.mock('react-native', () => ({
  View: 'native-view',
  Text: 'native-text',
}));

type TestRendererInstance = {
  root: {
    findByProps: (props: Record<string, unknown>) => unknown;
  };
};

const testRenderer = require('react-test-renderer') as {
  act: (callback: () => void) => void;
  create: (element: React.ReactElement) => TestRendererInstance;
};

describe('PersonalizedComponent primitives', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  const spec: ValidatedComponentSpec = {
    apiVersion: 'amaryllis/v1alpha1',
    kind: 'ComponentSpec',
    metadata: { name: 'primitive-card', version: '1.0.0' },
    target: { framework: 'react', runtime: 'rn' },
    props: {
      type: 'object',
      properties: {
        title: { type: 'string' },
      },
      required: ['title'],
    },
    ai: {
      mode: 'personalize',
      execution: 'device',
      generationContract: {
        output: 'props-json',
      },
    },
  };

  const contract = JSON.parse(new JSONSchemaGenerator().generate(spec));
  const Component = ((props: Record<string, unknown>) =>
    React.createElement('registered-component', props)) as ComponentType<
    Record<string, unknown>
  >;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should render validation errors through injected primitives', () => {
    const View = ({ children }: React.PropsWithChildren) =>
      React.createElement('primitive-view', { testID: 'wrapper' }, children);
    const Text = ({ children }: React.PropsWithChildren<{ style?: unknown }>) =>
      React.createElement('primitive-text', { testID: 'error' }, children);
    let rendered: TestRendererInstance | undefined;

    const initializeRegistry = (registry: {
      get: (name: string) => unknown;
      register: typeof import('../runtime/registry').ComponentRegistry.prototype.register;
    }) => {
      if (!registry.get('primitive-card')) {
        registry.register('primitive-card', {
          component: Component,
          spec,
          contract,
        });
      }
    };

    testRenderer.act(() => {
      rendered = testRenderer.create(
        React.createElement(
          RegistryProvider,
          { initialize: initializeRegistry },
          React.createElement(PersonalizedComponent, {
            name: 'primitive-card',
            baseProps: { title: 'Base' },
            personalizationData: { props: { title: 123 } },
            primitives: { View, Text },
          })
        )
      );
    });

    expect(rendered?.root.findByProps({ testID: 'wrapper' })).toBeDefined();
    expect(rendered?.root.findByProps({ testID: 'error' })).toBeDefined();
  });

  it('should default to React Native primitives', () => {
    expect(resolveUiPrimitives()).toEqual({
      View: 'native-view',
      Text: 'native-text',
    });
  });
});
