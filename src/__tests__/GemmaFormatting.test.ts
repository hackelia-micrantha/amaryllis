import { formatGemmaRequest, sanitizeGemmaOutput } from '../GemmaFormatting';

describe('Gemma formatting', () => {
  it('wraps user prompts with Gemma turn markers', () => {
    expect(formatGemmaRequest({ prompt: 'hello' })).toEqual({
      prompt: '<start_of_turn>user\nhello<end_of_turn>\n<start_of_turn>model\n',
    });
  });

  it('preserves non-prompt request fields', () => {
    expect(
      formatGemmaRequest({
        prompt: 'describe',
        images: ['file:///tmp/one.png'],
      })
    ).toEqual({
      prompt:
        '<start_of_turn>user\ndescribe<end_of_turn>\n<start_of_turn>model\n',
      images: ['file:///tmp/one.png'],
    });
  });

  it('removes leaked control tokens from output', () => {
    expect(
      sanitizeGemmaOutput(
        '<start_of_turn>model\nHello<end_of_turn> <|channel|> |> arst'
      )
    ).toBe('Hello  arst');
  });
});
