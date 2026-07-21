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

export function validateAndNormalizeLayout(
  layout: string,
  runtime: ReactLayoutRuntime,
  slots: readonly string[] = []
): LayoutValidationResult {
  if (UNSAFE_LAYOUT_PATTERN.test(layout)) {
    return {
      error:
        'component layout must not contain executable code, imports, event handlers, spread props, or raw HTML sinks',
    };
  }

  const allowedExpressions = new Set(['children', ...slots]);
  let normalized = layout;
  const expressions = [...layout.matchAll(/\{([^{}]+)\}/g)];

  for (const match of expressions) {
    const expression = match[1].trim();
    const slotMatch = /^slots\.([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(expression);
    const normalizedExpression = slotMatch?.[1] ?? expression;

    if (!allowedExpressions.has(normalizedExpression)) {
      return {
        error: `component layout expression '${expression}' must reference children or a declared slot`,
      };
    }

    if (slotMatch) {
      normalized = normalized.replace(match[0], `{${normalizedExpression}}`);
    }
  }

  const withoutAllowedExpressions = normalized.replace(/\{[^{}]+\}/g, '');
  if (/[{}]/.test(withoutAllowedExpressions)) {
    return { error: 'component layout contains an invalid JSX expression' };
  }

  const allowedElements = runtime === 'rn' ? NATIVE_ELEMENTS : WEB_ELEMENTS;
  const tags = [...normalized.matchAll(/<\/?([A-Za-z][A-Za-z0-9]*)\b/g)];
  for (const tag of tags) {
    if (!allowedElements.has(tag[1])) {
      return {
        error: `component layout element '${tag[1]}' is not allowed for ${runtime}`,
      };
    }
  }

  return { layout: normalized };
}
