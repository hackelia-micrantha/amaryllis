import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  JSONSchemaGenerator,
  PersonalizationEngine,
  stableStringify,
  useRegistry,
  type ComponentRegistry,
} from '@micrantha/amaryllis-components';
import { PersonaProfileCard } from '../ai/PersonaProfileCard';
import { personaProfileCardSpec } from '../ai/personaProfileCardSpec';
import { resolveAudience, type Audience } from './audienceResolver';
import { audiencePresentation } from './audiencePresentation';

const cardKey = 'persona-profile-card@1.0.0';
const expectedSpec = stableStringify(personaProfileCardSpec);
const expectedContract = stableStringify(
  JSON.parse(new JSONSchemaGenerator().generate(personaProfileCardSpec))
);

const options: readonly { id: Audience; label: string }[] = [
  { id: 'unknown', label: 'Neutral' },
  { id: 'developer', label: 'Developer' },
  { id: 'security_reviewer', label: 'Security reviewer' },
  { id: 'hiring_manager', label: 'Hiring manager' },
  { id: 'open_source_contributor', label: 'Open-source contributor' },
  { id: 'founder_customer', label: 'Founder/customer' },
];

// Reuse registry and contract validation, but do not render a package-owned
// diagnostic or unvalidated base props when the demo cannot admit its card.
export function resolveAudienceCard(
  registry: ComponentRegistry,
  engine: PersonalizationEngine,
  audience: Audience
) {
  try {
    const entry = registry.getExact(cardKey);
    if (
      !entry ||
      !Object.is(entry.component, PersonaProfileCard) ||
      stableStringify(entry.spec) !== expectedSpec ||
      stableStringify(entry.contract) !== expectedContract
    ) {
      return undefined;
    }

    const presentation = audiencePresentation(audience);
    if (!presentation) return undefined;

    // All props come from reviewed application-owned fixtures. The resolver
    // selects only their finite audience keys, never arbitrary content.
    const result = engine.validate(entry.contract, presentation);
    if (!result.valid || !result.data) return undefined;

    return {
      component: entry.component,
      key: entry.key,
      variant: presentation.variant,
      props: engine.apply({}, result.data),
    };
  } catch {
    return undefined;
  }
}

export function AudienceDemoScreen() {
  const [manual, setManual] = useState<Audience>();
  const registry = useRegistry();
  const engine = useMemo(() => new PersonalizationEngine(), []);
  // This native tab has no URL adapter. Browser navigation is a later slice.
  const resolution = resolveAudience({ manual, routeDefault: 'unknown' });
  const card = resolveAudienceCard(registry, engine, resolution.audience);
  const Card = card?.component;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text accessibilityRole="header" style={styles.heading}>
        Deterministic audience preview
      </Text>
      <Text>
        Choose a presentation preference. No model, identity inference or
        additional permissions are involved.
      </Text>
      <View style={styles.switcher}>
        {options.map(({ id, label }) => (
          <TouchableOpacity
            key={id}
            accessibilityRole="button"
            accessibilityState={{ selected: resolution.audience === id }}
            onPress={() => setManual(id)}
            style={[
              styles.button,
              resolution.audience === id && styles.selectedButton,
            ]}
          >
            <Text>{label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setManual(undefined)}
          style={styles.button}
        >
          <Text>Reset preference</Text>
        </TouchableOpacity>
      </View>
      {card && Card ? (
        <Card {...card.props} />
      ) : (
        <Text>Audience preview unavailable.</Text>
      )}
      <Text accessibilityRole="header" style={styles.sectionHeading}>
        Resolved presentation
      </Text>
      <Text selectable>
        {JSON.stringify(
          {
            ...resolution,
            component: card?.key ?? null,
            variant: card?.variant ?? null,
          },
          null,
          2
        )}
      </Text>
      <Text accessibilityRole="header" style={styles.sectionHeading}>
        Trust boundary
      </Text>
      <Text>
        Only reviewed copy and declared card variants may change. The exact
        registered component and contract remain authoritative. This preview
        grants no access or execution authority.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
    backgroundColor: '#fff',
  },
  heading: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '700',
  },
  sectionHeading: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '600',
  },
  switcher: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
  },
  selectedButton: {
    backgroundColor: '#dbeafe',
    borderColor: '#2563eb',
  },
});
