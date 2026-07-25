import { ComponentRegistry, fnv1aHash } from '../runtime/registry';

export const createTestComponentRegistry = () => {
  return new ComponentRegistry({
    hash: fnv1aHash,
  });
};

export const registry = createTestComponentRegistry();
