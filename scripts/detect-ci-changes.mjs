import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { classifyCiChanges } from './classify-ci-changes.mjs';

function parseNulDelimitedPaths(output) {
  return output
    .toString('utf8')
    .split('\0')
    .filter(path => path.length > 0);
}

function renderPath(path) {
  return JSON.stringify(path).replaceAll('`', '\\u0060');
}

function failClosed(reason) {
  return {
    runRoot: true,
    runComponents: true,
    runNative: true,
    reason,
    paths: [],
  };
}

export function detectCiChanges({ cwd = process.cwd(), baseSha, headSha }) {
  if (!baseSha || !headSha) {
    return failClosed('base or head revision was unavailable; running all CI validation');
  }

  try {
    const output = execFileSync(
      'git',
      ['diff', '--no-renames', '--name-only', '-z', `${baseSha}...${headSha}`],
      {
        cwd,
        encoding: 'buffer',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    const paths = parseNulDelimitedPaths(output);
    const classification = classifyCiChanges(paths);

    return { ...classification, paths };
  } catch {
    return failClosed('git change detection failed; running all CI validation');
  }
}

export function formatGithubOutputs(result) {
  return [
    `run_root=${result.runRoot}`,
    `run_components=${result.runComponents}`,
    `run_native=${result.runNative}`,
    `reason=${result.reason}`,
    `changed_count=${result.paths.length}`,
    '',
  ].join('\n');
}

export function formatJobSummary(result) {
  const displayedPaths = result.paths.slice(0, 20);
  const lines = [
    '## CI change classification',
    '',
    `- Root validation: **${result.runRoot ? 'run' : 'skipped'}**`,
    `- Components validation: **${result.runComponents ? 'run' : 'skipped'}**`,
    `- Native matrix: **${result.runNative ? 'run' : 'skipped'}**`,
    `- Reason: ${result.reason}`,
    `- Changed paths: ${result.paths.length}`,
  ];

  if (displayedPaths.length > 0) {
    lines.push('', '### Paths', '');
    for (const path of displayedPaths) {
      lines.push(`- \`${renderPath(path)}\``);
    }
    if (result.paths.length > displayedPaths.length) {
      lines.push(`- …and ${result.paths.length - displayedPaths.length} more`);
    }
  }

  return `${lines.join('\n')}\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , baseSha, headSha] = process.argv;
  const result = detectCiChanges({ baseSha, headSha });

  process.stdout.write(formatGithubOutputs(result));
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, formatJobSummary(result));
  }
}
