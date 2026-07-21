import { ReactGenerator } from '../generator/react';
import {
  ComponentSpecSchema,
  type ValidatedComponentSpec,
} from '../schema/spec.schema';

const createSpec = (layout: string): ValidatedComponentSpec => ({
  apiVersion: 'amaryllis/v1alpha1',
  kind: 'ComponentSpec',
  metadata: { name: 'unsafe-card', version: '1.0.0' },
  props: {
    type: 'object',
    properties: {
      title: { type: 'string' },
    },
  },
  target: { framework: 'react', runtime: 'web' },
  ui: { layout },
  ai: { mode: 'scaffold', execution: 'build' },
});

describe('unsafe layout rejection', () => {
  const unsafeLayouts = [
    "<div>{Function('return 1')()}</div>",
    "<div>{import('unsafe-package')}</div>",
    "<div>{Function/* bypass */('return 1')()}</div>",
    "<div>{import/* bypass */('unsafe-package')}</div>",
    "<div>{new/* bypass */Function/* bypass */('return 1')()}</div>",
  ];

  it.each(unsafeLayouts)(
    'rejects callable expressions during schema validation: %s',
    (layout) => {
      const result = ComponentSpecSchema.safeParse(createSpec(layout));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              message:
                'component layout must not contain imports, exports, scripts, eval, require, or Function constructors',
            }),
          ])
        );
      }
    }
  );

  it.each(unsafeLayouts)(
    'rejects callable expressions in the generator: %s',
    (layout) => {
      expect(() => new ReactGenerator().generate(createSpec(layout))).toThrow(
        'Unsafe layout contains executable code or import/export syntax.'
      );
    }
  );

  it('rejects callable expressions in variant layouts', () => {
    const spec = createSpec('<div>{children}</div>');
    spec.ui = {
      layout: '<div>{children}</div>',
      variants: {
        unsafe: {
          layout: "<div>{Function/* bypass */('return 1')()}</div>",
        },
      },
    };

    expect(() => new ReactGenerator().generate(spec)).toThrow(
      'Unsafe layout contains executable code or import/export syntax.'
    );
  });
});
