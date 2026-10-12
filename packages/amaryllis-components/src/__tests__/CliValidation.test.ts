import { parseComponentSpec } from '../parser/yaml';
import {
  applyCustomizationAndValidate,
  validateSpecForGeneration,
} from '../cli/validation';
import { ReactGenerator } from '../generator/react';

const yaml = `
apiVersion: amaryllis/v1alpha1
kind: ComponentSpec
metadata:
  name: test-card
  version: 1.0.0
target:
  framework: react
  runtime: web
props:
  type: object
  properties:
    title:
      type: string
  required:
    - title
ui:
  layout: "<div>{children}</div>"
ai:
  mode: scaffold
  execution: build
`;

const base = () => validateSpecForGeneration(parseComponentSpec(yaml));

describe('CLI component generation boundary', () => {
  it('accepts a valid customization while leaving the reviewed base unchanged', () => {
    const spec = base();
    const before = JSON.stringify(spec);
    const changed = applyCustomizationAndValidate(spec, [
      {
        op: 'replace',
        path: '/props/properties/title/type',
        value: 'number',
      },
    ]);

    expect(spec.props.properties.title).toEqual({ type: 'string' });
    expect(JSON.stringify(spec)).toBe(before);
    expect(changed.props.properties.title).toEqual({ type: 'number' });
    expect(new ReactGenerator().generate(changed)).toContain('title: number;');
  });

  const invalidPatches: Array<[string, unknown]> = [
    ['API version', [{ op: 'replace', path: '/apiVersion', value: 'amaryllis/v99' }]],
    ['kind', [{ op: 'replace', path: '/kind', value: 'Untrusted' }]],
    [
      'invalid prop identifier',
      [
        {
          op: 'add',
          path: '/props/properties/invalid-name',
          value: { type: 'string' },
        },
      ],
    ],
    [
      'undeclared required prop',
      [{ op: 'add', path: '/props/required/-', value: 'missing' }],
    ],
    [
      'unsafe layout',
      [{ op: 'replace', path: '/ui/layout', value: '<script>x</script>' }],
    ],
    [
      'invalid runtime',
      [{ op: 'replace', path: '/target/runtime', value: 'untrusted' }],
    ],
    [
      'device scaffold',
      [{ op: 'replace', path: '/ai/execution', value: 'device' }],
    ],
    [
      'invalid structure',
      [{ op: 'replace', path: '/props', value: 'bad' }],
    ],
  ];

  it.each(invalidPatches)(
    'rejects a post-patch %s violation through the canonical schema',
    (_label, patch) => {
      const spec = base();
      const snapshot = JSON.stringify(spec);
      expect(() => applyCustomizationAndValidate(spec, patch)).toThrow();
      expect(JSON.stringify(spec)).toBe(snapshot);
    }
  );

  it('rejects policy-invalid device specifications even when schema-valid', () => {
    const changed = [
      { op: 'replace', path: '/ai/mode', value: 'personalize' },
      { op: 'replace', path: '/ai/execution', value: 'device' },
      {
        op: 'add',
        path: '/ai/generationContract',
        value: { output: 'props-json' },
      },
    ];
    expect(() => applyCustomizationAndValidate(base(), changed)).toThrow(
      'runtime.networkAccess'
    );
  });

  it('rejects malformed patch operations and prototype-modifying paths', () => {
    const spec = base();
    for (const patch of [
      { op: 'replace', path: '/kind', value: 'ComponentSpec' },
      [{ op: 'bogus', path: '/kind', value: 'ComponentSpec' }],
      [{ op: 'replace', path: '/does-not-exist', value: 'x' }],
      [
        {
          op: 'add',
          path: '/props/properties/__proto__',
          value: { type: 'string' },
        },
      ],
    ]) {
      expect(() => applyCustomizationAndValidate(spec, patch)).toThrow();
    }
    expect(spec.props.properties).toEqual({ title: { type: 'string' } });
  });

  it('fails on an invalid pre-generation candidate instead of claiming policy validation', () => {
    expect(() =>
      validateSpecForGeneration({ ...base(), kind: 'Untrusted' })
    ).toThrow();
  });
});
