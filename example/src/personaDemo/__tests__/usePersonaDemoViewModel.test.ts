import {
  createPersonaDemoViewState,
  initialPersonaDemoState,
  reducePersonaDemoState,
} from '../usePersonaDemoViewModel';
import { personas } from '../domain';

describe('persona demo view model', () => {
  it('defaults to developer persona', () => {
    const viewState = createPersonaDemoViewState(initialPersonaDemoState);

    expect(viewState.selectedPersonaId).toBe('developer');
    expect(viewState.selectedPersona.label).toBe('Developer');
  });

  it.each(personas)('selects $label deterministically', (persona) => {
    const nextState = reducePersonaDemoState(initialPersonaDemoState, {
      type: 'select-persona',
      personaId: persona.id,
    });
    const viewState = createPersonaDemoViewState(nextState);

    expect(viewState.selectedPersonaId).toBe(persona.id);
    expect(viewState.selectedPersona).toEqual(persona);
  });

  it('derives personalized component props from selected persona', () => {
    const nextState = reducePersonaDemoState(initialPersonaDemoState, {
      type: 'select-persona',
      personaId: 'security-reviewer',
    });
    const viewState = createPersonaDemoViewState(nextState);

    expect(viewState.personalizationData).toEqual({
      variant: 'assurance',
      props: {
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
    });
  });
});
