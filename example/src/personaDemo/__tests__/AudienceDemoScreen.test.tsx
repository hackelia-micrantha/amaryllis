import { fireEvent, render } from '@testing-library/react-native';
import {
  ComponentRegistry,
  PersonalizationEngine,
  RegistryProvider,
} from '@micrantha/amaryllis-components';
import { registerExampleAiComponents } from '../../ai/registerComponents';
import { AudienceDemoScreen, resolveAudienceCard } from '../AudienceDemoScreen';

const cardKey = 'persona-profile-card@1.0.0';

describe('native audience preview', () => {
  it('renders and resets a reviewed preference without an LLM provider', () => {
    const screen = render(
      <RegistryProvider initialize={registerExampleAiComponents}>
        <AudienceDemoScreen />
      </RegistryProvider>
    );

    expect(screen.getByText('Amaryllis overview')).toBeTruthy();

    fireEvent.press(screen.getByText('Security reviewer'));

    expect(
      screen.getByText('Personalization that still respects governance')
    ).toBeTruthy();
    expect(screen.getByText(/"reason": "explicit-manual"/)).toBeTruthy();
    expect(
      screen.getByText(/"component": "persona-profile-card@1.0.0"/)
    ).toBeTruthy();

    fireEvent.press(screen.getByText('Reset preference'));

    expect(screen.getByText('Amaryllis overview')).toBeTruthy();
    expect(screen.getByText(/"reason": "route-default"/)).toBeTruthy();
  });

  it('validates all six reviewed presentations through the actual registry', () => {
    const registry = new ComponentRegistry();
    registerExampleAiComponents(registry);
    const engine = new PersonalizationEngine();

    const cases = [
      ['unknown', 'momentum'],
      ['developer', 'momentum'],
      ['security_reviewer', 'assurance'],
      ['hiring_manager', 'momentum'],
      ['open_source_contributor', 'community'],
      ['founder_customer', 'assurance'],
    ] as const;

    for (const [audience, variant] of cases) {
      const card = resolveAudienceCard(registry, engine, audience);
      expect(card?.key).toBe(cardKey);
      expect(card?.variant).toBe(variant);
      expect(card?.props.variant).toBe(variant);
      expect(typeof card?.props.title).toBe('string');
    }
  });

  it('renders only an application-owned fallback when the exact entry is absent', () => {
    const screen = render(
      <RegistryProvider>
        <AudienceDemoScreen />
      </RegistryProvider>
    );

    expect(screen.getByText('Audience preview unavailable.')).toBeTruthy();
    expect(screen.queryByText('Amaryllis overview')).toBeNull();
  });

  it('denies a different implementation registered at the same version', () => {
    const registry = new ComponentRegistry();
    registerExampleAiComponents(registry);
    const entry = registry.getExact(cardKey);
    if (!entry) throw new Error('Expected fixture registration');

    registry.register(
      cardKey,
      { ...entry, component: () => null },
      { replace: true }
    );

    expect(
      resolveAudienceCard(registry, new PersonalizationEngine(), 'developer')
    ).toBeUndefined();
  });

  it('denies an altered contract at the expected version', () => {
    const registry = new ComponentRegistry();
    registerExampleAiComponents(registry);
    const entry = registry.getExact(cardKey);
    if (!entry) throw new Error('Expected fixture registration');

    registry.register(
      cardKey,
      {
        component: entry.component,
        spec: entry.spec,
        contract: { ...entry.contract, additionalProperties: true },
      },
      { replace: true }
    );

    expect(
      resolveAudienceCard(registry, new PersonalizationEngine(), 'developer')
    ).toBeUndefined();
  });
});
