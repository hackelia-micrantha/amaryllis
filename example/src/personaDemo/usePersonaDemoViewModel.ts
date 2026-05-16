import { useCallback, useMemo, useReducer } from 'react';
import { personas, type Persona, type PersonaId } from './domain';

export interface PersonaDemoState {
  selectedPersonaId: PersonaId;
}

export type PersonaDemoIntent = {
  type: 'select-persona';
  personaId: PersonaId;
};

export interface PersonaDemoViewState {
  selectedPersonaId: PersonaId;
  selectedPersona: Persona;
  personaOptions: Persona[];
  baseProps: {
    eyebrow: string;
    title: string;
    summary: string;
    proofPoints: string[];
  };
  personalizationData: {
    variant: Persona['variant'];
    props: {
      eyebrow: string;
      title: string;
      summary: string;
      proofPoints: string[];
    };
  };
}

export const initialPersonaDemoState: PersonaDemoState = {
  selectedPersonaId: 'developer',
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
  }
};

export const createPersonaDemoViewState = (
  state: PersonaDemoState
): PersonaDemoViewState => {
  const selectedPersona =
    personas.find((persona) => persona.id === state.selectedPersonaId) ??
    personas[0];

  return {
    selectedPersonaId: selectedPersona.id,
    selectedPersona,
    personaOptions: personas,
    baseProps: {
      eyebrow: 'Amaryllis',
      title: 'Adaptive components',
      summary: 'Personalized UI with contracts.',
      proofPoints: [],
    },
    personalizationData: {
      variant: selectedPersona.variant,
      props: {
        eyebrow: selectedPersona.eyebrow,
        title: selectedPersona.title,
        summary: selectedPersona.summary,
        proofPoints: selectedPersona.proofPoints,
      },
    },
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

  return {
    state: viewState,
    selectPersona,
  };
};
