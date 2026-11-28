import { audiencePresentation } from '../audiencePresentation';
import type { Audience } from '../audienceResolver';
import { resolveAudience } from '../audienceResolver';
import { personas } from '../domain';

const cases = [
  ['developer', 'developer', 'momentum'],
  ['security_reviewer', 'security-reviewer', 'assurance'],
  ['hiring_manager', 'hiring-manager', 'momentum'],
  ['open_source_contributor', 'open-source-contributor', 'community'],
  ['founder_customer', 'founder-customer', 'assurance'],
] as const;

describe('audience presentation fixtures', () => {
  it.each(cases)(
    'maps %s to the reviewed %s persona',
    (audience, personaId, variant) => {
      const persona = personas.find((entry) => entry.id === personaId);
      expect(persona).toBeDefined();
      expect(audiencePresentation(audience)).toEqual({
        variant,
        props: {
          eyebrow: persona?.eyebrow,
          title: persona?.title,
          summary: persona?.summary,
          proofPoints: persona?.proofPoints,
        },
      });
    }
  );

  it('uses the neutral presentation for explicit and fallback unknown', () => {
    const neutral = audiencePresentation('unknown');
    expect(neutral?.props.eyebrow).toBe('Amaryllis overview');
    expect(neutral?.props.proofPoints).toHaveLength(3);
    expect(audiencePresentation(resolveAudience({}).audience)).toEqual(
      neutral
    );
    expect(
      audiencePresentation(
        resolveAudience({
          manual: 'unknown',
          routeDefault: 'developer',
        }).audience
      )
    ).toEqual(neutral);
  });

  it('does not let rejected hints select a fixture', () => {
    const resolution = resolveAudience({
      queryValues: ['<script>untrusted</script>'],
      manual: 'constructor',
      routeDefault: 'unknown',
    });
    expect(audiencePresentation(resolution.audience)).toEqual(
      audiencePresentation('unknown')
    );
  });

  it('returns independent props without modifying reviewed fixtures', () => {
    const first = audiencePresentation('developer');
    const second = audiencePresentation('developer');
    expect(first).toEqual(second);
    expect(first?.props.proofPoints).not.toBe(second?.props.proofPoints);
    first?.props.proofPoints.push('not reviewed');
    expect(audiencePresentation('developer')).toEqual(second);
  });

  it('cannot select prototype keys as persona identifiers', () => {
    expect(audiencePresentation('constructor' as Audience)).toBeUndefined();
    expect(audiencePresentation('__proto__' as Audience)).toBeUndefined();
  });
});
