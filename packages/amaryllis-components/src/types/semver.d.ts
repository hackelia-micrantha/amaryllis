// Narrow declaration for the maintained semver runtime dependency.
// Amaryllis only consumes strict validation, precedence, and prerelease state.
declare module 'semver' {
  export function valid(version: string): string | null;
  export function compare(left: string, right: string): number;
  export function prerelease(
    version: string
  ): ReadonlyArray<string | number> | null;
}
