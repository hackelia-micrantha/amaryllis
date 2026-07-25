import { useCallback, useMemo, useReducer } from 'react';
import { personas, type Persona } from './domain';

export type PersonaId =
  | 'developer'
  | 'security-reviewer'
  | 'hiring-manager'
  | 'open-source-contributor'
  | 'founder-customer'
  | 'ai';

export type PersonaVariant = 'assurance' | 'momentum' | 'community';

export interface PersonaDemoState {
  selectedPersonaId: PersonaId;
  aiPersonalizationData?: {
    variant: PersonaVariant;
    props: {
      eyebrow: string;
      title: string;
      summary: string;
      proofPoints: string[];
    };
  };
  isGenerating: boolean;
}

export type PersonaDemoIntent =
  | { type: 'select-persona'; personaId: PersonaId }
  | { type: 'set-ai-personalization'; data: any }
  | { type: 'set-is-generating'; isGenerating: boolean };

export interface PersonaDemoViewState {
  selectedPersonaId: PersonaId;
  selectedPersona?: Persona;
  personaOptions: (Persona | { id: 'ai'; label: string })[];
  isGenerating: boolean;
  baseProps: {
    eyebrow: string;
    title: string;
    summary: string;
    proofPoints: string[];
  };
  personalizationData: {
    variant: PersonaVariant;
    props: {
      eyebrow: string;
      title: string;
      summary: string;
      proofPoints: string[];
    };
  } | null;
}

export const initialPersonaDemoState: PersonaDemoState = {
  selectedPersonaId: 'developer',
  isGenerating: false,
};

export const reducePersonaDemoState = (
  state: PersonaDemoState,
  intent: PersonaDemoIntent
): PersonaDemoState => {
  switch (intent.type) {
    case 'select-persona':
      return {
        ...state,
        selectedPersonaId: intent.personaId,
      };
    case 'set-ai-personalization':
      return {
        ...state,
        aiPersonalizationData: intent.data,
        isGenerating: false,
      };
    case 'set-is-generating':
      return {
        ...state,
        isGenerating: intent.isGenerating,
      };
  }
};

export const createPersonaDemoViewState = (
  state: PersonaDemoState
): PersonaDemoViewState => {
  const selectedPersona = personas.find(
    (persona) => persona.id === state.selectedPersonaId
  );

  const personaOptions = [
    ...personas,
    { id: 'ai' as const, label: '✨ AI Personalized' },
  ];

  const baseProps = {
    eyebrow: 'Amaryllis',
    title: 'Adaptive components',
    summary: 'Personalized UI with contracts.',
    proofPoints: [],
  };

  let personalizationData = null;

  if (selectedPersona) {
    personalizationData = {
      variant: selectedPersona.variant,
      props: {
        eyebrow: selectedPersona.eyebrow,
        title: selectedPersona.title,
        summary: selectedPersona.summary,
        proofPoints: selectedPersona.proofPoints,
      },
    };
  } else if (state.selectedPersonaId === 'ai' && state.aiPersonalizationData) {
    personalizationData = state.aiPersonalizationData;
  }

  return {
    selectedPersonaId: state.selectedPersonaId,
    selectedPersona,
    personaOptions,
    isGenerating: state.isGenerating,
    baseProps,
    personalizationData,
  };
};

export const usePersonaDemoViewModel = () => {
  const [state, dispatch] = useReducer(
    reducePersonaDemoState,
    initialPersonaDemoState
  );

  const viewState = useMemo(() => createPersonaDemoViewState(state), [state]);

  const selectPersona = useCallback(
    (personaId: PersonaId) => {
      dispatch({ type: 'select-persona', personaId });
    },
    [dispatch]
  );

  const setAiPersonalization = useCallback(
    (data: any) => {
      dispatch({ type: 'set-ai-personalization', data });
    },
    [dispatch]
  );

  const setIsGenerating = useCallback(
    (isGenerating: boolean) => {
      dispatch({ type: 'set-is-generating', isGenerating });
    },
    [dispatch]
  );

  return {
    state: viewState,
    selectPersona,
    setAiPersonalization,
    setIsGenerating,
  };
};
