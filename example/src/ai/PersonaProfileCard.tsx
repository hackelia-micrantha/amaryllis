import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface PersonaProfileCardProps {
  eyebrow: string;
  title: string;
  summary: string;
  proofPoints: string[];
  variant?: string;
}

export const PersonaProfileCard: React.FC<PersonaProfileCardProps> = ({
  eyebrow,
  title,
  summary,
  proofPoints,
  variant,
}) => (
  <View
    style={[
      styles.card,
      variant === 'assurance' && styles.assuranceCard,
      variant === 'momentum' && styles.momentumCard,
      variant === 'community' && styles.communityCard,
    ]}
  >
    <Text style={styles.eyebrow}>{eyebrow}</Text>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.summary}>{summary}</Text>
    <View style={styles.points}>
      {proofPoints.map((point) => (
        <Text key={point} style={styles.point}>
          • {point}
        </Text>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#eef4ff',
  },
  assuranceCard: {
    backgroundColor: '#ecfeff',
  },
  momentumCard: {
    backgroundColor: '#eef4ff',
  },
  communityCard: {
    backgroundColor: '#f5f3ff',
  },
  eyebrow: {
    marginBottom: 6,
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  title: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
  },
  summary: {
    marginTop: 8,
    color: '#374151',
    fontSize: 15,
    lineHeight: 21,
  },
  points: {
    marginTop: 12,
    gap: 6,
  },
  point: {
    color: '#1f2937',
    fontSize: 14,
  },
});
