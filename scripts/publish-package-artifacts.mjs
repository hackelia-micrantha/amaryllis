import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const options = { manifest: null, tag: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--manifest') {
      options.manifest = argv[++index] ?? null;
    } else if (argument === '--tag') {
      options.tag = argv[++index] ?? null;
    } else {
      throw new Error(`Unknown publish argument: ${argument}`);
    }
  }
  if (!options.manifest) {
    throw new Error('--manifest is required');
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifestPath = resolve(options.manifest);
  const artifactDirectory = dirname(manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.publishOrder)) {
    throw new Error('Unsupported package release manifest');
  }

  const packagesByName = Object.fromEntries(
    manifest.packages.map((entry) => [entry.name, entry])
  );
  const published = [];

  for (const packageName of manifest.publishOrder) {
    const entry = packagesByName[packageName];
    if (!entry) {
      throw new Error(`Release manifest is missing ${packageName}`);
    }
    const tarball = resolve(artifactDirectory, entry.filename);
    const args = ['publish', tarball, '--access', 'public'];
    if (options.tag) {
      args.push('--tag', options.tag);
    }

    try {
      await execFileAsync('npm', args, {
        env: process.env,
        maxBuffer: 20 * 1024 * 1024,
      });
      published.push(`${entry.name}@${entry.version}`);
      console.log(`Published ${entry.name}@${entry.version}`);
    } catch (error) {
      const pending = manifest.publishOrder
        .slice(published.length)
        .map((name) => {
          const pkg = packagesByName[name];
          return pkg ? `${pkg.name}@${pkg.version}` : name;
        });
      console.error(
        JSON.stringify(
          {
            failed: `${entry.name}@${entry.version}`,
            published,
            pending,
            recovery:
              'Do not rebuild. Reuse the same preflight artifact set and resume only after confirming registry state.',
          },
          null,
          2
        )
      );
      if (error.stdout) process.stderr.write(error.stdout);
      if (error.stderr) process.stderr.write(error.stderr);
      throw error;
    }
  }
}

await main();
