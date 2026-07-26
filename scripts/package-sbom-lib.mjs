import fs from 'node:fs';
import path from 'node:path';

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseYarnLock(lockText) {
  const descriptorMap = new Map();
  let current = null;
  let section = null;

  function commit() {
    if (!current) return;
    for (const descriptor of current.descriptors) {
      if (descriptorMap.has(descriptor)) {
        throw new Error(`Yarn lockfile contains duplicate descriptor ${descriptor}`);
      }
      descriptorMap.set(descriptor, current);
    }
  }

  for (const rawLine of lockText.split(/\r?\n/)) {
    if (!rawLine || rawLine.startsWith('#') || rawLine.startsWith('__metadata:')) continue;

    if (!rawLine.startsWith(' ') && rawLine.endsWith(':')) {
      commit();
      const key = unquote(rawLine.slice(0, -1));
      current = {
        descriptors: key.split(', ').map(unquote),
        version: null,
        resolution: null,
        dependencies: {},
      };
      section = null;
      continue;
    }

    if (!current) continue;
    const fieldMatch = rawLine.match(/^  (\S[^:]*):(?:\s+(.*))?$/);
    if (fieldMatch) {
      const [, field, rawValue] = fieldMatch;
      if (rawValue === undefined) {
        section = field;
      } else {
        section = null;
        const value = unquote(rawValue);
        if (field === 'version') current.version = value;
        if (field === 'resolution') current.resolution = value;
      }
      continue;
    }

    const nestedMatch = rawLine.match(/^    (.+?):\s+(.+)$/);
    if (nestedMatch && section === 'dependencies') {
      const [, name, range] = nestedMatch;
      current.dependencies[unquote(name)] = unquote(range);
    }
  }

  commit();
  return descriptorMap;
}

function npmPath(name) {
  return encodeURIComponent(name).replace(/%2F/g, '/');
}

function npmPurl(name, version) {
  return `pkg:npm/${npmPath(name)}@${encodeURIComponent(version)}`;
}

function createPublishedRoot(manifest) {
  const purl = npmPurl(manifest.name, manifest.version);
  return { type: 'library', name: manifest.name, version: manifest.version, purl, 'bom-ref': purl };
}

function createPeerComponent(name, range) {
  const purl = npmPurl(name, range);
  return {
    type: 'library',
    name,
    version: range,
    scope: 'optional',
    purl,
    'bom-ref': purl,
    properties: [{ name: 'cdx:npm:dependencyType', value: 'peer' }],
  };
}

function descriptorFor(name, range) {
  return range.startsWith('npm:') ? `${name}@${range}` : `${name}@npm:${range}`;
}

function requiredEntries(manifest) {
  return Object.entries(manifest.dependencies ?? {}).map(([name, range]) => ({ name, range }));
}

function peerEntries(manifest) {
  return Object.entries(manifest.peerDependencies ?? {}).map(([name, range]) => ({ name, range }));
}

export function derivePackageSboms({ source, packageSpecs, lockText }) {
  const sourceComponents = Array.isArray(source.components) ? source.components : [];
  const sourceComponentsByPurl = new Map(
    sourceComponents.filter((component) => component.purl).map((component) => [component.purl, component])
  );
  const lockDescriptors = parseYarnLock(lockText);
  const publishedByName = new Map(
    packageSpecs.map((spec) => [spec.manifest.name, { ...spec, root: createPublishedRoot(spec.manifest) }])
  );

  function resolveLockedPackage(name, range) {
    const descriptor = descriptorFor(name, range);
    const locked = lockDescriptors.get(descriptor);
    if (!locked?.version) throw new Error(`Yarn lockfile has no exact resolution for ${descriptor}`);
    return locked;
  }

  function createLockedComponent(name, locked) {
    const purl = npmPurl(name, locked.version);
    const enriched = sourceComponentsByPurl.get(purl);
    return {
      ...(enriched ?? {}),
      type: enriched?.type ?? 'library',
      name,
      version: locked.version,
      purl,
      'bom-ref': purl,
    };
  }

  return packageSpecs.map((packageSpec) => {
    const manifest = packageSpec.manifest;
    const root = publishedByName.get(manifest.name).root;
    const componentByRef = new Map();
    const dependencyByRef = new Map();
    const pendingPublished = [manifest.name];
    const processedPublished = new Set();
    const pendingLocked = [];
    const processedLocked = new Set();

    while (pendingPublished.length > 0) {
      const publishedName = pendingPublished.pop();
      if (processedPublished.has(publishedName)) continue;
      processedPublished.add(publishedName);
      const publishedSpec = publishedByName.get(publishedName);
      const publishedRoot = publishedSpec.root;
      if (publishedName !== manifest.name) componentByRef.set(publishedRoot['bom-ref'], publishedRoot);
      const directRefs = [];

      for (const { name, range } of requiredEntries(publishedSpec.manifest)) {
        const workspaceDependency = publishedByName.get(name);
        if (workspaceDependency) {
          directRefs.push(workspaceDependency.root['bom-ref']);
          componentByRef.set(workspaceDependency.root['bom-ref'], workspaceDependency.root);
          pendingPublished.push(name);
        } else {
          const locked = resolveLockedPackage(name, range);
          const component = createLockedComponent(name, locked);
          directRefs.push(component['bom-ref']);
          componentByRef.set(component['bom-ref'], component);
          pendingLocked.push({ name, locked });
        }
      }

      for (const { name, range } of peerEntries(publishedSpec.manifest)) {
        const peer = createPeerComponent(name, range);
        directRefs.push(peer['bom-ref']);
        componentByRef.set(peer['bom-ref'], peer);
        dependencyByRef.set(peer['bom-ref'], []);
      }
      dependencyByRef.set(publishedRoot['bom-ref'], [...new Set(directRefs)].sort());
    }

    while (pendingLocked.length > 0) {
      const { name, locked } = pendingLocked.pop();
      const key = `${name}@${locked.version}`;
      if (processedLocked.has(key)) continue;
      processedLocked.add(key);
      const component = createLockedComponent(name, locked);
      const dependencyRefs = [];
      for (const [dependencyName, dependencyRange] of Object.entries(locked.dependencies)) {
        const dependencyLocked = resolveLockedPackage(dependencyName, dependencyRange);
        const dependencyComponent = createLockedComponent(dependencyName, dependencyLocked);
        dependencyRefs.push(dependencyComponent['bom-ref']);
        componentByRef.set(dependencyComponent['bom-ref'], dependencyComponent);
        pendingLocked.push({ name: dependencyName, locked: dependencyLocked });
      }
      dependencyByRef.set(component['bom-ref'], [...new Set(dependencyRefs)].sort());
    }

    componentByRef.delete(root['bom-ref']);
    const output = {
      ...source,
      serialNumber: undefined,
      metadata: { ...source.metadata, component: root },
      components: [...componentByRef.values()].sort((a, b) =>
        String(a['bom-ref']).localeCompare(String(b['bom-ref']))
      ),
      dependencies: [...dependencyByRef.entries()]
        .map(([ref, dependsOn]) => ({ ref, dependsOn }))
        .sort((a, b) => a.ref.localeCompare(b.ref)),
    };
    return { slug: packageSpec.slug, output, bytes: `${JSON.stringify(output, null, 2)}\n` };
  });
}

export function derivePackageSbomsFromFiles({ inputPath, outputDir, packageSpecs, lockPath }) {
  const source = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const specs = packageSpecs.map((spec) => ({
    ...spec,
    manifest: JSON.parse(fs.readFileSync(spec.manifestPath, 'utf8')),
  }));
  const results = derivePackageSboms({ source, packageSpecs: specs, lockText: fs.readFileSync(lockPath, 'utf8') });
  fs.mkdirSync(outputDir, { recursive: true });
  for (const result of results) {
    const outputPath = path.join(outputDir, `${result.slug}.cdx.json`);
    fs.writeFileSync(outputPath, result.bytes);
    console.log(
      `Derived ${outputPath}: ${result.output.components.length + 1} components, ${result.output.dependencies.length} dependency nodes`
    );
  }
  return results;
}
