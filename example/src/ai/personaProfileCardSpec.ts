import type { ValidatedComponentSpec } from '@micrantha/amaryllis-components';

export const personaProfileCardSpec: ValidatedComponentSpec = {
  apiVersion: 'amaryllis/v1alpha1',
  kind: 'ComponentSpec',
  metadata: {
    name: 'persona-profile-card',
    version: '1.0.0',
    owner: 'amaryllis-example',
    stability: 'experimental',
  },
  target: {
    framework: 'react',
    runtime: 'rn',
  },
  props: {
    type: 'object',
    properties: {
      eyebrow: { type: 'string' },
      title: { type: 'string' },
      summary: { type: 'string' },
      proofPoints: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['eyebrow', 'title', 'summary', 'proofPoints'],
  },
  ui: {
    variants: {
      assurance: {},
      momentum: {},
      community: {},
    },
  },
  ai: {
    mode: 'personalize',
    execution: 'device',
    generationContract: {
      output: 'props-json',
    },
  },
};
