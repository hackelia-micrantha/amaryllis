import { resolveAudience } from '../audienceResolver';

const audiences = [
  'developer',
  'security_reviewer',
  'hiring_manager',
  'open_source_contributor',
  'founder_customer',
  'unknown',
] as const;

describe('deterministic audience resolution', () => {
  it.each(audiences)('admits the explicit query audience %s', (audience) => {
    expect(resolveAudience({ queryValues: [audience] })).toEqual({
      audience,
      confidence: audience === 'unknown' ? 0 : 1,
      hints: [{ audience, source: 'query' }],
      resolvedBy: ['query'],
      reason: 'explicit-query',
    });
  });

  it('preserves precedence and admitted losing hints', () => {
    expect(
      resolveAudience({
        queryValues: ['security_reviewer'],
        manual: 'developer',
        routeDefault: 'founder_customer',
      })
    ).toEqual({
      audience: 'security_reviewer',
      confidence: 1,
      hints: [
        { audience: 'security_reviewer', source: 'query' },
        { audience: 'developer', source: 'manual' },
        { audience: 'founder_customer', source: 'route' },
      ],
      resolvedBy: ['query'],
      reason: 'explicit-query',
    });
  });

  it.each([
    { label: 'absent', queryValues: [] },
    { label: 'empty', queryValues: [''] },
    { label: 'case mismatch', queryValues: ['Developer'] },
    { label: 'leading whitespace', queryValues: [' developer'] },
    { label: 'trailing whitespace', queryValues: ['developer '] },
    { label: 'legacy persona ID', queryValues: ['security-reviewer'] },
    { label: 'duplicate', queryValues: ['developer', 'developer'] },
    {
      label: 'conflict',
      queryValues: ['developer', 'security_reviewer'],
    },
    { label: 'prototype key', queryValues: ['__proto__'] },
    { label: 'markup', queryValues: ['<script>alert(1)</script>'] },
    { label: 'null', queryValues: [null] },
    { label: 'number', queryValues: [42] },
    { label: 'coercible object', queryValues: [{ toString: () => 'developer' }] },
  ])('rejects $label query occurrences', ({ queryValues }) => {
    expect(
      resolveAudience({
        queryValues,
        manual: 'hiring_manager',
        routeDefault: 'developer',
      })
    ).toEqual({
      audience: 'hiring_manager',
      confidence: 1,
      hints: [
        { audience: 'hiring_manager', source: 'manual' },
        { audience: 'developer', source: 'route' },
      ],
      resolvedBy: ['manual'],
      reason: 'explicit-manual',
    });
  });

  it.each(audiences)('admits the manual audience %s', (audience) => {
    expect(resolveAudience({ manual: audience })).toEqual({
      audience,
      confidence: audience === 'unknown' ? 0 : 1,
      hints: [{ audience, source: 'manual' }],
      resolvedBy: ['manual'],
      reason: 'explicit-manual',
    });
  });

  it.each(audiences)('admits the reviewed route default %s', (audience) => {
    expect(
      resolveAudience({ manual: 'unrecognized', routeDefault: audience })
    ).toEqual({
      audience,
      confidence: audience === 'unknown' ? 0 : 1,
      hints: [{ audience, source: 'route' }],
      resolvedBy: ['route'],
      reason: 'route-default',
    });
  });

  it('does not skip an explicit neutral query', () => {
    expect(
      resolveAudience({
        queryValues: ['unknown'],
        manual: 'developer',
        routeDefault: 'security_reviewer',
      })
    ).toEqual({
      audience: 'unknown',
      confidence: 0,
      hints: [
        { audience: 'unknown', source: 'query' },
        { audience: 'developer', source: 'manual' },
        { audience: 'security_reviewer', source: 'route' },
      ],
      resolvedBy: ['query'],
      reason: 'explicit-query',
    });
  });

  it('does not skip an explicit neutral manual selection', () => {
    expect(
      resolveAudience({ manual: 'unknown', routeDefault: 'developer' })
    ).toMatchObject({
      audience: 'unknown',
      confidence: 0,
      resolvedBy: ['manual'],
      reason: 'explicit-manual',
    });
  });

  it('uses neutral fallback without admitting untrusted values', () => {
    expect(
      resolveAudience({
        queryValues: ['untrusted query'],
        manual: { audience: 'developer' },
        routeDefault: 'constructor',
      })
    ).toEqual({
      audience: 'unknown',
      confidence: 0,
      hints: [],
      resolvedBy: [],
      reason: 'neutral-default',
    });
    expect(resolveAudience({})).toEqual({
      audience: 'unknown',
      confidence: 0,
      hints: [],
      resolvedBy: [],
      reason: 'neutral-default',
    });
  });

  it('returns independent result snapshots without mutating inputs', () => {
    const queryValues = Object.freeze(['developer']);
    const inputs = Object.freeze({
      queryValues,
      manual: 'security_reviewer',
    });
    const first = resolveAudience(inputs);
    const second = resolveAudience(inputs);

    expect(first).toEqual(second);
    expect(first.hints).not.toBe(second.hints);
    expect(first.hints[0]).not.toBe(second.hints[0]);
    expect(first.resolvedBy).not.toBe(second.resolvedBy);
    expect(queryValues).toEqual(['developer']);
  });
});
