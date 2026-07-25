import { gemmaProtocol } from '../GemmaProtocol';

describe('Gemma formatting', () => {
  it('wraps user prompts with Gemma turn markers', () => {
    expect(gemmaProtocol.formatRequest({ prompt: 'hello' })).toEqual({
      prompt: '<start_of_turn>user\nhello<end_of_turn>\n<start_of_turn>model\n',
    });
  });

  it('preserves non-prompt request fields', () => {
    expect(
      gemmaProtocol.formatRequest({
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
      gemmaProtocol.sanitizeOutput(
        '<start_of_turn>model\nHello<end_of_turn> <|channel|> |> arst'
      )
    ).toBe('Hello');
  });

  it('truncates output at first completed Gemma turn', () => {
    expect(
      gemmaProtocol.sanitizeOutput(
        'Hello there<end_of_turn><eos><start_of_turn>user\nhow can i learn a new language?'
      )
    ).toBe('Hello there');
  });

  it('truncates output at eos when no end-of-turn marker is present', () => {
    expect(
      gemmaProtocol.sanitizeOutput(
        'Hello there<eos><start_of_turn>user\nhow can i learn a new language?'
      )
    ).toBe('Hello there');
  });
});
