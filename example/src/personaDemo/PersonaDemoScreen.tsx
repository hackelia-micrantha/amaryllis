import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PersonalizedComponent } from '@micrantha/amaryllis-components';
import { usePersonaDemoViewModel } from './usePersonaDemoViewModel';

export const PersonaDemoScreen = () => {
  const { state, selectPersona } = usePersonaDemoViewModel();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Personalized Amaryllis</Text>
      <Text style={styles.subheading}>
        One product story, adapted to the viewer without changing the component
        contract.
      </Text>

      <View style={styles.switcher}>
        {state.personaOptions.map((persona) => {
          const isSelected = persona.id === state.selectedPersonaId;

          return (
            <TouchableOpacity
              key={persona.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => selectPersona(persona.id)}
              style={[
                styles.personaButton,
                isSelected && styles.selectedPersonaButton,
              ]}
            >
              <Text
                style={[
                  styles.personaButtonLabel,
                  isSelected && styles.selectedPersonaButtonLabel,
                ]}
              >
                {persona.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <PersonalizedComponent
        name="persona-profile-card"
        baseProps={state.baseProps}
        personalizationData={state.personalizationData}
      />
    </ScrollView>
  );
};

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
  subheading: {
    color: '#4b5563',
    fontSize: 15,
    lineHeight: 21,
  },
  switcher: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  personaButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  selectedPersonaButton: {
    borderColor: '#2563eb',
    backgroundColor: '#dbeafe',
  },
  personaButtonLabel: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedPersonaButtonLabel: {
    color: '#1d4ed8',
  },
});
