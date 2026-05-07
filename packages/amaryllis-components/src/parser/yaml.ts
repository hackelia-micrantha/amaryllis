import yaml from 'js-yaml';
import {
  ComponentSpecSchema,
  type ValidatedComponentSpec,
} from '../schema/spec.schema';

export function parseComponentSpec(content: string): ValidatedComponentSpec {
  const raw = yaml.load(content);
  return ComponentSpecSchema.parse(raw);
}

export function stringifyComponentSpec(spec: ValidatedComponentSpec): string {
  return yaml.dump(spec);
}
