import React from 'react';
import type { ComponentType } from 'react';
import { JSONSchemaGenerator } from '../generator/schema';
import { PersonalizedComponent } from '../runtime/PersonalizedComponent';
import { ComponentRegistry } from '../runtime/registry';
import { RegistryProvider } from '../runtime/registryContext';
import type { ValidatedComponentSpec } from '../schema/spec.schema';

jest.mock('react-native', () => ({
  View: 'native-view',
  Text: 'native-text',
}));

interface Renderer {
  update: (element: React.ReactElement) => void;
  unmount: () => void;
}

const renderer = require('react-test-renderer') as {
  act: (callback: () => void) => void;
  create: (element: React.ReactElement) => Renderer;
};

const spec: ValidatedComponentSpec = {
  apiVersion: 'amaryllis/v1alpha1',
  kind: 'ComponentSpec',
  metadata: { name: 'card', version: '1.0.0' },
  target: { framework: 'react', runtime: 'rn' },
  props: {
    type: 'object',
    properties: { title: { type: 'string' } },
    required: ['title'],
  },
  ai: {
    mode: 'personalize',
    execution: 'device',
    generationContract: { output: 'props-json' },
  },
};

describe('PersonalizedComponent render consistency', () => {
  const observed: unknown[] = [];
  const Card = ((props: Record<string, unknown>) => {
    observed.push(props.title);
    return React.createElement('registered-card', props);
  }) as ComponentType<Record<string, unknown>>;

  const contract = JSON.parse(new JSONSchemaGenerator().generate(spec));
  const initialize = (registry: ComponentRegistry) => {
    registry.register('card', { component: Card, spec, contract });
  };

  const element = (
    baseProps?: Record<string, unknown>,
    personalizationData?: unknown
  ) =>
    React.createElement(
      RegistryProvider,
      { initialize },
      React.createElement(PersonalizedComponent, {
        name: 'card@1.0.0',
        baseProps,
        personalizationData,
      })
    );

  beforeEach(() => {
    observed.length = 0;
  });

  it('does not render the previous personalized value during an identity switch', () => {
    let tree: Renderer | undefined;
    renderer.act(() => {
      tree = renderer.create(
        element({ title: 'A base' }, { props: { title: 'A personal' } })
      );
    });
    expect(observed).toEqual(['A personal']);

    observed.length = 0;
    renderer.act(() => {
      tree?.update(
        element({ title: 'B base' }, { props: { title: 'B personal' } })
      );
    });
    expect(observed).toEqual(['B personal']);
    renderer.act(() => tree?.unmount());
  });

  it('falls back to current base props immediately on invalid output', () => {
    let tree: Renderer | undefined;
    renderer.act(() => {
      tree = renderer.create(
        element({ title: 'A base' }, { props: { title: 'A personal' } })
      );
    });

    observed.length = 0;
    renderer.act(() => {
      tree?.update(element({ title: 'B base' }, { props: { title: 123 } }));
    });
    expect(observed).toEqual(['B base']);
    renderer.act(() => tree?.unmount());
  });

  it('renders omitted base props without triggering a state update loop', () => {
    let tree: Renderer | undefined;
    renderer.act(() => {
      tree = renderer.create(element());
    });
    expect(observed).toEqual([undefined]);
    renderer.act(() => tree?.unmount());
  });
});
