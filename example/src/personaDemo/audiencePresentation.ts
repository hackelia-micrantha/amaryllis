import type { Audience } from './audienceResolver';
import { personas, type PersonaId, type PersonaVariant } from './domain';

type CardProps = {
  eyebrow: string;
  title: string;
  summary: string;
  proofPoints: string[];
};

export type AudiencePresentation = {
  variant: PersonaVariant;
  props: CardProps;
};

const personaByAudience = {
  developer: 'developer',
  security_reviewer: 'security-reviewer',
  hiring_manager: 'hiring-manager',
  open_source_contributor: 'open-source-contributor',
  founder_customer: 'founder-customer',
} as const satisfies Record<Exclude<Audience, 'unknown'>, PersonaId>;

// Reviewed neutral copy; no inferred identity or model-generated claims.
export function audiencePresentation(
  audience: Audience
): AudiencePresentation | undefined {
  if (audience === 'unknown') {
    return {
      variant: 'momentum',
      props: {
        eyebrow: 'Amaryllis overview',
        title: 'Governed on-device adaptive components',
        summary:
          'Explore local inference, context and registered component contracts without choosing a persona.',
        proofPoints: [
          'Local multimodal inference',
          'Application-owned context',
          'Schema and registry validation',
        ],
      },
    };
  }

  const persona = personas.find(
    (entry) => entry.id === personaByAudience[audience]
  );
  if (!persona) return undefined;

  return {
    variant: persona.variant,
    props: {
      eyebrow: persona.eyebrow,
      title: persona.title,
      summary: persona.summary,
      proofPoints: [...persona.proofPoints],
    },
  };
}
