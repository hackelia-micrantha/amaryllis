import * as fc from 'fast-check';
import { validateContextItems } from '../ContextValidation';
import type { ContextItem, ContextPolicy } from '../ContextTypes';
import { ValidationError } from '../Errors';

const runs = {
  seed: 94001,
  numRuns: process.env.AMARYLLIS_PROPERTY_NIGHTLY === 'true' ? 1000 : 100,
};

const policy: ContextPolicy = {
  media: {
    requireAbsoluteUri: true,
    allowedUriSchemes: ['file'],
    maxMediaBytes: 1024,
    maxMediaWidth: 256,
    maxMediaHeight: 256,
  },
};

const text = fc.string({ maxLength: 32 }).map((value) => 'x' + value);
const boundedItem = fc.record({
  id: text,
  text,
  createdAt: fc.integer({ min: 1, max: 2000000000 }),
  tags: fc.array(text, { minLength: 1, maxLength: 4 }),
  metadata: fc.dictionary(text, text, { maxKeys: 4 }),
  media: fc.array(
    fc.record({
      uri: fc.integer({ min: 1 }).map((id) => 'file:///image-' + id),
      sizeBytes: fc.integer({ min: 1, max: 1024 }),
      width: fc.integer({ min: 1, max: 256 }),
      height: fc.integer({ min: 1, max: 256 }),
    }),
    { minLength: 1, maxLength: 3 }
  ),
});

describe('Context validation properties', () => {
  it('preserves bounded JSON input without mutation', () => {
    fc.assert(
      fc.property(boundedItem, (item) => {
        const parsed: ContextItem = JSON.parse(JSON.stringify(item));
        validateContextItems([parsed], policy);
        expect(parsed).toEqual(item);
      }),
      runs
    );
  });

  it('rejects malformed runtime metadata, tags and media with typed errors', () => {
    const malformed = fc.oneof(
      fc.constantFrom(
        { tags: null },
        { tags: 'tag' },
        { metadata: [] },
        { metadata: null },
        { media: null },
        { media: [null] }
      ),
      fc.integer().map((value) => ({ metadata: { source: value } })),
      fc.integer().map((value) => ({ tags: [value] })),
      fc.integer().map((value) => ({ media: [{ uri: value }] }))
    );
    fc.assert(
      fc.property(boundedItem, malformed, (item, patch) => {
        const invalid = { ...item, ...patch } as unknown as ContextItem;
        expect(() => validateContextItems([invalid], policy)).toThrow(
          ValidationError
        );
      }),
      runs
    );
  });

  it('rejects every generated disallowed URI or out-of-bound dimension', () => {
    const violation = fc.oneof(
      fc.integer({ min: 1025 }).map((sizeBytes) => ({ sizeBytes })),
      fc.integer({ min: 257 }).map((width) => ({ width })),
      fc.integer({ min: 257 }).map((height) => ({ height })),
      fc.constantFrom({ uri: 'https://example.invalid/x' }, { uri: 'relative' })
    );
    fc.assert(
      fc.property(boundedItem, violation, (item, patch) => {
        const invalid: ContextItem = {
          ...item,
          media: item.media.map((reference, index) =>
            index === 0 ? { ...reference, ...patch } : reference
          ),
        };
        expect(() => validateContextItems([invalid], policy)).toThrow(
          ValidationError
        );
      }),
      runs
    );
  });
});
