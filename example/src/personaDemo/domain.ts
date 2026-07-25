export type PersonaId =
  | 'developer'
  | 'security-reviewer'
  | 'hiring-manager'
  | 'open-source-contributor'
  | 'founder-customer';

export type PersonaVariant = 'assurance' | 'momentum' | 'community';

export interface Persona {
  id: PersonaId;
  label: string;
  variant: PersonaVariant;
  eyebrow: string;
  title: string;
  summary: string;
  proofPoints: string[];
}

export const personas: [Persona, ...Persona[]] = [
  {
    id: 'developer',
    label: 'Developer',
    variant: 'momentum',
    eyebrow: 'Developer view',
    title: 'Build adaptive UI without losing structure',
    summary:
      'Amaryllis pairs stable component contracts with controlled personalization, so teams can move quickly without turning the UI layer into guesswork.',
    proofPoints: [
      'Typed component specs',
      'On-device personalization runtime',
      'Reusable registry-backed components',
    ],
  },
  {
    id: 'security-reviewer',
    label: 'Security reviewer',
    variant: 'assurance',
    eyebrow: 'Security reviewer view',
    title: 'Personalization that still respects governance',
    summary:
      'Amaryllis validates generated output against explicit contracts before rendering, keeping adaptation inside reviewable boundaries.',
    proofPoints: [
      'Schema-validated personalization',
      'Constrained variants and props',
      'Clear governance surface',
    ],
  },
  {
    id: 'hiring-manager',
    label: 'Hiring manager',
    variant: 'momentum',
    eyebrow: 'Hiring manager view',
    title: 'A product system, not just a component gallery',
    summary:
      'Amaryllis shows systems thinking: architecture, developer experience, and user-facing differentiation working together.',
    proofPoints: [
      'Clean separation of concerns',
      'Product-aware technical choices',
      'Portfolio-ready narrative',
    ],
  },
  {
    id: 'open-source-contributor',
    label: 'Open-source contributor',
    variant: 'community',
    eyebrow: 'Open-source contributor view',
    title: 'Clear contracts make contribution easier',
    summary:
      'Amaryllis gives contributors a visible path from spec to component to runtime behavior, which lowers the cost of helping well.',
    proofPoints: [
      'Readable component specs',
      'Predictable registry model',
      'Extension without hidden coupling',
    ],
  },
  {
    id: 'founder-customer',
    label: 'Founder/customer',
    variant: 'assurance',
    eyebrow: 'Founder/customer view',
    title: 'Different users see the value that matters to them',
    summary:
      'Amaryllis turns one product surface into several relevant conversations, without rebuilding the product for every audience.',
    proofPoints: [
      'Sharper product storytelling',
      'Trust-preserving personalization',
      'Differentiation without sprawl',
    ],
  },
];
