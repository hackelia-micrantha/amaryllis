import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import ts from 'typescript';

import { ReactGenerator } from '../generator/react';
import type { ValidatedComponentSpec } from '../schema/spec.schema';

const GENERATED_AT = new Date('2026-01-01T00:00:00.000Z');
const RUNTIMES = ['web', 'nextjs', 'rn'] as const;

type Runtime = (typeof RUNTIMES)[number];

function createSpec(runtime: Runtime): ValidatedComponentSpec {
  return {
    apiVersion: 'amaryllis/v1alpha1',
    kind: 'ComponentSpec',
    metadata: { name: `compiled-${runtime}-card`, version: '1.0.0' },
    props: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        settings: {
          type: 'object',
          properties: {
            tone: { type: 'string', enum: ['info', 'warning'] },
          },
          required: ['tone'],
        },
      },
      required: ['title'],
    },
    ui: {
      slots: ['header'],
      layout:
        runtime === 'rn'
          ? '<View>{slots.header}{children}</View>'
          : '<section>{slots.header}{children}</section>',
    },
    target: { framework: 'react', runtime },
    ai: { mode: 'scaffold', execution: 'build' },
  };
}

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
  return diagnostics
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    )
    .join('\n');
}

function typecheckGeneratedSource(source: string): readonly ts.Diagnostic[] {
  const directory = mkdtempSync(join(tmpdir(), 'amaryllis-generated-'));
  const sourcePath = join(directory, 'generated.tsx');
  const declarationsPath = join(directory, 'generated-types.d.ts');

  writeFileSync(sourcePath, source, 'utf8');
  writeFileSync(
    declarationsPath,
    `declare namespace React {
  type ReactNode = any;
  interface FC<P = Record<string, never>> {
    (props: P): any;
  }
}
declare module 'react' { export = React; }
declare module 'react-native' {
  export const View: React.FC<Record<string, unknown>>;
  export const Text: React.FC<Record<string, unknown>>;
}
declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
  namespace JSX {
    interface IntrinsicElements {
      article: Record<string, unknown>;
      aside: Record<string, unknown>;
      div: Record<string, unknown>;
      footer: Record<string, unknown>;
      header: Record<string, unknown>;
      main: Record<string, unknown>;
      section: Record<string, unknown>;
      span: Record<string, unknown>;
    }
  }
}
`,
    'utf8'
  );

  try {
    const program = ts.createProgram([sourcePath, declarationsPath], {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      jsx: ts.JsxEmit.ReactJSX,
      noEmit: true,
    });

    return ts.getPreEmitDiagnostics(program);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('ReactGenerator source hardening', () => {
  const generator = new ReactGenerator();

  it.each<Runtime>(RUNTIMES)(
    'emits %s source that typechecks under package-compatible options',
    (runtime) => {
      const source = generator.generate(createSpec(runtime), {
        generatedAt: GENERATED_AT,
      });
      const diagnostics = typecheckGeneratedSource(source);

      expect(formatDiagnostics(diagnostics)).toBe('');
    }
  );

  it('normalizes declared slot references', () => {
    const source = generator.generate(createSpec('web'), {
      generatedAt: GENERATED_AT,
    });

    expect(source).toContain('<section>{header}{children}</section>');
    expect(source).not.toContain('{slots.header}');
  });

  it.each([
    ['undeclared expressions', '<div>{dangerous()}</div>'],
    ['event handlers', '<div onClick={children}>{children}</div>'],
    ['spread props', '<div {...children}>{children}</div>'],
    ['unapproved web elements', '<iframe>{children}</iframe>'],
    [
      'statement breakout',
      '<div>{children}</div>); arbitraryCall(); return (<div>{children}</div>',
    ],
    ['unbalanced elements', '<div><span>{children}</div>'],
    ['non-JSX source', 'plainIdentifier'],
    ['multiple roots', '<div>{children}</div><div>{children}</div>'],
    ['attributes', '<div className="card">{children}</div>'],
    ['unmatched closing brace', '<div>}</div>'],
    ['unmatched closing brace after text', '<div>text }</div>'],
  ])('rejects %s in web layouts', (_name, layout) => {
    const spec = createSpec('web');
    spec.ui = { ...spec.ui, layout };

    expect(() => generator.generate(spec)).toThrow();
  });

  it('rejects web elements in React Native layouts', () => {
    const spec = createSpec('rn');
    spec.ui = { ...spec.ui, layout: '<div>{children}</div>' };

    expect(() => generator.generate(spec)).toThrow(
      "component layout element 'div' is not allowed for rn"
    );
  });
});
