import { getLineDiff } from '../cli/diff';

describe('getLineDiff', () => {
  it('should preserve order when repeated lines move around changed content', () => {
    const diff = getLineDiff(
      ['function Card() {', '  return title;', '}', ''].join('\n'),
      [
        'function Card() {',
        '  const label = title;',
        '  return label;',
        '}',
        '',
      ].join('\n')
    );

    expect(diff).toContain('\x1b[31m-   return title;\x1b[0m');
    expect(diff).toContain('\x1b[32m+   const label = title;\x1b[0m');
    expect(diff).toContain('\x1b[32m+   return label;\x1b[0m');
    expect(diff).toContain('  }');
  });

  it('should report duplicate line additions instead of matching any existing line', () => {
    const diff = getLineDiff(
      ['items.map(renderItem)', 'return footer', ''].join('\n'),
      [
        'items.map(renderItem)',
        'items.map(renderItem)',
        'return footer',
        '',
      ].join('\n')
    );

    expect(diff).toContain('\x1b[32m+ items.map(renderItem)\x1b[0m');
    expect(diff).toContain('  return footer');
  });
});
