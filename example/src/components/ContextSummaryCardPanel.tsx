import { PersonalizedComponent } from '@micrantha/amaryllis-components';
import { useMemo } from 'react';
import { usePromptContext } from '../PromptContext';

export const ContextSummaryCardPanel = () => {
  const { results, images } = usePromptContext();

  const baseProps = useMemo(
    () => ({
      title: 'Conversation context',
      description:
        'No generated context yet. Start a conversation to adapt me.',
    }),
    []
  );

  const personalizationData = useMemo(
    () => ({
      ...(results.length === 0 && { variant: 'compact' }),
      props: {
        title: 'Conversation context',
        description:
          results.length === 0
            ? 'No generated context yet. Start a conversation to adapt me.'
            : `${results.length} generated chunk${
                results.length === 1 ? '' : 's'
              } available${
                images.length > 0
                  ? ` with ${images.length} image${
                      images.length === 1 ? '' : 's'
                    } selected`
                  : ''
              }.`,
      },
    }),
    [images.length, results.length]
  );

  return (
    <PersonalizedComponent
      name="context-summary-card"
      baseProps={baseProps}
      personalizationData={personalizationData}
    />
  );
};
