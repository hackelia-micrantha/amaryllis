import * as fc from 'fast-check';
import {
  applyCustomizationAndValidate,
  validateSpecForGeneration,
} from '../cli/validation';
import { PolicyEngine } from '../policy/engine';
import { ComponentSpecSchema } from '../schema/spec.schema';
import { JSONSchemaGenerator } from '../generator/schema';
import { PersonalizationEngine } from '../runtime/engine';

const runs = {
  seed: 94002,
  numRuns: process.env.AMARYLLIS_PROPERTY_NIGHTLY === 'true' ? 1000 : 100,
};

const base = () =>
  validateSpecForGeneration({
    apiVersion: 'amaryllis/v1alpha1',
    kind: 'ComponentSpec',
    metadata: { name: 'property-card', version: '1.0.0' },
    target: { framework: 'react', runtime: 'web' },
    props: {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title'],
    },
    ai: { mode: 'scaffold', execution: 'build' },
  });

const types = fc.array(fc.constantFrom('string', 'number', 'boolean'), {
  minLength: 1,
  maxLength: 8,
});

const typePatches = (values: string[]) =>
  values.map((value) => ({
    op: 'replace',
    path: '/props/properties/title/type',
    value,
  }));

describe('ComponentSpec customization properties', () => {
  it('accepts valid patch sequences without mutating the original spec', () => {
    fc.assert(
      fc.property(types, (values) => {
        const spec = base();
        const snapshot = JSON.stringify(spec);
        const updated = applyCustomizationAndValidate(
          spec,
          typePatches(values)
        );
        expect(ComponentSpecSchema.safeParse(updated).success).toBe(true);
        expect(new PolicyEngine().validateSpec(updated).valid).toBe(true);
        expect(updated.props.properties.title?.type).toBe(
          values[values.length - 1]
        );
        expect(JSON.stringify(spec)).toBe(snapshot);
      }),
      runs
    );
  });

  it('rejects invalid final structure and policy without mutating the base', () => {
    const invalid = fc.constantFrom<
      Array<{ op: string; path: string; value: unknown }>
    >(
      [{ op: 'replace', path: '/props', value: 'invalid' }],
      [{ op: 'replace', path: '/kind', value: 'Untrusted' }],
      [
        { op: 'replace', path: '/ai/mode', value: 'personalize' },
        { op: 'replace', path: '/ai/execution', value: 'device' },
        {
          op: 'add',
          path: '/ai/generationContract',
          value: { output: 'props-json' },
        },
      ]
    );
    fc.assert(
      fc.property(types, invalid, (values, tail) => {
        const spec = base();
        const snapshot = JSON.stringify(spec);
        expect(() =>
          applyCustomizationAndValidate(spec, [...typePatches(values), ...tail])
        ).toThrow();
        expect(JSON.stringify(spec)).toBe(snapshot);
      }),
      runs
    );
  });
});

describe('runtime personalization mutation properties', () => {
  const contract = JSON.parse(
    new JSONSchemaGenerator().generate({
      ...base(),
      ai: {
        mode: 'personalize',
        execution: 'device',
        generationContract: { output: 'json-patch' },
      },
      policy: {
        runtime: { networkAccess: 'none', domAccess: 'restricted' },
      },
    })
  );
  const engine = new PersonalizationEngine();
  const labels = fc.array(fc.string({ maxLength: 64 }), {
    minLength: 1,
    maxLength: 8,
  });
  const titlePatches = (values: string[]) =>
    values.map((value) => ({
      op: 'replace',
      path: '/props/title',
      value,
    }));

  it('accepts declared mutations and publishes only the last title', () => {
    fc.assert(
      fc.property(labels, (values) => {
        const result = engine.validate(contract, {
          props: { title: 'base' },
          patches: titlePatches(values),
        });
        expect(result.valid).toBe(true);
        expect(result.data).toEqual({
          props: { title: values[values.length - 1] },
        });
        expect(engine.apply({ title: 'base' }, result.data ?? {})).toEqual({
          title: values[values.length - 1],
        });
      }),
      runs
    );
  });

  it('fails closed if a sequence contains a forbidden mutation path', () => {
    const paths = fc.constantFrom(
      '/policy/runtime/networkAccess',
      '/metadata/name',
      '/props/undeclared',
      '/props/__proto__',
      '/props/constructor',
      '/props/prototype'
    );
    fc.assert(
      fc.property(labels, paths, (values, path) => {
        const result = engine.validate(contract, {
          props: { title: 'base' },
          patches: [
            ...titlePatches(values),
            { op: 'add', path, value: 'untrusted' },
          ],
        });
        expect(result.valid).toBe(false);
        expect(result.data).toBeUndefined();
      }),
      runs
    );
  });
});
