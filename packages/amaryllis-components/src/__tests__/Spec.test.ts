import { parseComponentSpec } from '../parser/yaml';

describe('ComponentSpec Parser', () => {
  it('should parse a valid spec', () => {
    const yaml = `
apiVersion: amaryllis/v1alpha1
kind: ComponentSpec
metadata:
  name: test-comp
  version: 1.0.0
target:
  framework: react
  runtime: web
props:
  type: object
  properties:
    label:
      type: string
ai:
  mode: scaffold
  execution: build
`;
    const spec = parseComponentSpec(yaml);
    expect(spec.metadata.name).toBe('test-comp');
    expect(spec.target.runtime).toBe('web');
  });

  it('should throw error for invalid spec', () => {
    const yaml = `
apiVersion: amaryllis/v1alpha1
kind: ComponentSpec
metadata:
  name: test-comp
# Missing required fields like target, props, ai
`;
    expect(() => parseComponentSpec(yaml)).toThrow();
  });

  it('should reject executable output for device execution', () => {
    const yaml = `
apiVersion: amaryllis/v1alpha1
kind: ComponentSpec
metadata:
  name: runtime-card
  version: 1.0.0
target:
  framework: react
  runtime: rn
props:
  type: object
  properties:
    title:
      type: string
ai:
  mode: personalize
  execution: device
  generationContract:
    output: tsx
`;
    expect(() => parseComponentSpec(yaml)).toThrow(
      'device execution cannot output TSX or executable code'
    );
  });

  it('should reject prop names that cannot be generated as identifiers', () => {
    const yaml = `
apiVersion: amaryllis/v1alpha1
kind: ComponentSpec
metadata:
  name: invalid-props
  version: 1.0.0
target:
  framework: react
  runtime: web
props:
  type: object
  properties:
    cta-text:
      type: string
ai:
  mode: scaffold
  execution: build
`;

    expect(() => parseComponentSpec(yaml)).toThrow(
      'generated component prop names must be valid JavaScript identifiers'
    );
  });
});
