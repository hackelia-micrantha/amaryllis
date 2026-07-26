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

export function detectCiChanges({ cwd = process.cwd(), baseSha, headSha }) {
  if (!baseSha || !headSha) {
    return {
      runNative: true,
      reason: 'base or head revision was unavailable; running the full native matrix',
      paths: [],
    };
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
    return {
      runNative: true,
      reason: 'git change detection failed; running the full native matrix',
      paths: [],
    };
  }
}

export function formatGithubOutputs(result) {
  return [
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
