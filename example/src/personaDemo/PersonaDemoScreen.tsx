import { useCallback } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PersonalizedComponent } from '@micrantha/amaryllis-components';
import { useInference } from '@micrantha/react-native-amaryllis';
import { usePersonaDemoViewModel } from './usePersonaDemoViewModel';

export const PersonaDemoScreen = () => {
  const { state, selectPersona, setAiPersonalization, setIsGenerating } =
    usePersonaDemoViewModel();

  const onResult = useCallback(
    (result: string) => {
      try {
        // Try to find JSON in the response
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          setAiPersonalization(data);
        } else {
          console.warn('No JSON found in AI response:', result);
        }
      } catch (err) {
        console.error('Failed to parse AI personalization:', err);
      } finally {
        setIsGenerating(false);
      }
    },
    [setAiPersonalization, setIsGenerating]
  );

  const generate = useInference({
    onGenerate: () => setIsGenerating(true),
    onResult,
    onError: (err) => {
      console.error('AI generation error:', err);
      setIsGenerating(false);
    },
  });

  const handleSelectPersona = (id: string) => {
    selectPersona(id as any);
    if (id === 'ai') {
      generate({
        prompt: `Generate a JSON personalization for a product card. 
The product is "Amaryllis", an on-device AI component library.
Target Audience: A tech-savvy product manager.
The output MUST be a single JSON object with this structure:
{
  "variant": "momentum",
  "props": {
    "eyebrow": "AI GEN",
    "title": "title here",
    "summary": "summary here",
    "proofPoints": ["point 1", "point 2", "point 3"]
  }
}
Do not include any other text.`,
      });
    }
  };

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
              onPress={() => handleSelectPersona(persona.id)}
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

      {state.isGenerating ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Generating AI Persona...</Text>
        </View>
      ) : (
        <PersonalizedComponent
          name="persona-profile-card"
          baseProps={state.baseProps}
          personalizationData={state.personalizationData}
          fallback={<Text>Select a persona to see it in action.</Text>}
        />
      )}
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
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 14,
  },
});
