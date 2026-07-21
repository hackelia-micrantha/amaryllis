const JS_TRIVIA = String.raw`(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*(?:\r?\n|$))*`;

const UNSAFE_LAYOUT_PATTERN = new RegExp(
  `(?:<script\\b|\\bimport(?:\\s+|${JS_TRIVIA}\\()|\\bexport\\s+|\\brequire${JS_TRIVIA}\\(|\\beval${JS_TRIVIA}\\(|\\b(?:new${JS_TRIVIA})?Function${JS_TRIVIA}\\(|dangerouslySetInnerHTML|\\bon[A-Z][A-Za-z]*\\s*=|\\{\\s*\\.\\.\\.)`,
  'i'
);

const WEB_ELEMENTS = new Set([
  'article',
  'aside',
  'div',
  'footer',
  'header',
  'main',
  'section',
  'span',
]);
const NATIVE_ELEMENTS = new Set(['Text', 'View']);

export type ReactLayoutRuntime = 'nextjs' | 'web' | 'rn';

export interface LayoutValidationResult {
  layout?: string;
  error?: string;
}

function invalidLayout(error: string): LayoutValidationResult {
  return { error };
}

export function validateAndNormalizeLayout(
  layout: string,
  runtime: ReactLayoutRuntime,
  slots: readonly string[] = []
): LayoutValidationResult {
  if (UNSAFE_LAYOUT_PATTERN.test(layout)) {
    return invalidLayout(
      'Unsafe layout contains executable code or import/export syntax.'
    );
  }

  const allowedElements = runtime === 'rn' ? NATIVE_ELEMENTS : WEB_ELEMENTS;
  const allowedExpressions = new Set(['children', ...slots]);
  const elementStack: string[] = [];
  let normalized = '';
  let position = 0;
  let rootElements = 0;

  while (position < layout.length) {
    const remaining = layout.slice(position);

    if (remaining.startsWith('{')) {
      const expressionMatch = /^\{([^{}]+)\}/.exec(remaining);
      const expression = expressionMatch?.[1]?.trim();
      if (!expressionMatch || !expression || elementStack.length === 0) {
        return invalidLayout('component layout contains an invalid JSX expression');
      }

      const slotMatch = /^slots\.([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(expression);
      const normalizedExpression = slotMatch?.[1] ?? expression;
      if (!allowedExpressions.has(normalizedExpression)) {
        return invalidLayout(
          `component layout expression '${expression}' must reference children or a declared slot`
        );
      }

      normalized += `{${normalizedExpression}}`;
      position += expressionMatch[0].length;
      continue;
    }

    if (remaining.startsWith('<')) {
      const tagMatch = /^<(\/)?([A-Za-z][A-Za-z0-9]*)(\s*\/?)>/.exec(remaining);
      const closing = tagMatch?.[1] === '/';
      const tagName = tagMatch?.[2];
      const suffix = tagMatch?.[3];
      if (!tagMatch || !tagName || suffix === undefined) {
        return invalidLayout(
          'component layout must use attribute-free, balanced JSX elements'
        );
      }

      if (!allowedElements.has(tagName)) {
        return invalidLayout(
          `component layout element '${tagName}' is not allowed for ${runtime}`
        );
      }

      const selfClosing = !closing && suffix.trim() === '/';
      if (closing) {
        if (suffix.trim() !== '' || elementStack.pop() !== tagName) {
          return invalidLayout('component layout contains unbalanced JSX elements');
        }
      } else {
        if (elementStack.length === 0) {
          rootElements += 1;
          if (rootElements > 1) {
            return invalidLayout(
              'component layout must contain exactly one root JSX element'
            );
          }
        }
        if (!selfClosing) {
          elementStack.push(tagName);
        }
      }

      normalized += tagMatch[0];
      position += tagMatch[0].length;
      continue;
    }

    const nextToken = remaining.search(/[<{]/);
    const textLength = nextToken === -1 ? remaining.length : nextToken;
    const text = remaining.slice(0, textLength);
    if (elementStack.length === 0 && text.trim() !== '') {
      return invalidLayout(
        'component layout must contain only one complete JSX element'
      );
    }

    normalized += text;
    position += textLength;
  }

  if (rootElements !== 1 || elementStack.length !== 0) {
    return invalidLayout('component layout contains unbalanced JSX elements');
  }

  return { layout: normalized };
}
