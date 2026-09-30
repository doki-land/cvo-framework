/**
 * Sync VMZ edge build into this package for CVO Worker host.
 * Input: projects/homepage/dist/server/_vmz/server-artifact.json + #server/**
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const homepageServer = path.resolve(pkgRoot, '../homepage/dist/server');
const artifactSrc = path.join(homepageServer, '_vmz', 'server-artifact.json');
const serverSrc = path.join(homepageServer, '#server');
const generated = path.join(pkgRoot, 'generated');
const serverOut = path.join(generated, 'server');

function fail(message) {
    console.error(`homepage-api prepare: ${message}`);
    process.exit(1);
}

if (!fs.existsSync(artifactSrc)) {
    fail(`missing ${artifactSrc} — run: pnpm --filter @cvo/homepage run build:server`);
}
if (!fs.existsSync(serverSrc)) {
    fail(`missing ${serverSrc}`);
}

fs.rmSync(generated, { recursive: true, force: true });
fs.mkdirSync(serverOut, { recursive: true });
fs.copyFileSync(artifactSrc, path.join(generated, 'server-artifact.json'));
fs.cpSync(serverSrc, serverOut, { recursive: true });

const artifact = JSON.parse(fs.readFileSync(path.join(generated, 'server-artifact.json'), 'utf8'));
const routes = Array.isArray(artifact.publicRoutes) ? artifact.publicRoutes : [];
if (routes.length === 0) {
    fail('ServerArtifact has no publicRoutes');
}

const moduleIds = [...new Set(routes.map((r) => String(r.moduleId)))];
const imports = [];
const entries = [];

for (let i = 0; i < moduleIds.length; i += 1) {
    const moduleId = moduleIds[i];
    if (!moduleId.startsWith('#server/')) {
        fail(`unexpected moduleId ${moduleId}`);
    }
    const rel = moduleId.slice('#server/'.length);
    const filePath = path.join(serverOut, `${rel}.js`);
    if (!fs.existsSync(filePath)) {
        fail(`missing compiled module ${filePath}`);
    }
    const importPath = `./server/${rel}.js`.replaceAll('\\', '/');
    const alias = `m${i}`;
    imports.push(`import * as ${alias} from '${importPath}';`);
    entries.push(`    ${JSON.stringify(moduleId)}: () => Promise.resolve(${alias}),`);
}

const modulesTs = `${imports.join('\n')}

/** moduleId → compiled VMZ #server namespace (Wrangler-bundled). */
export const serverModules = {
${entries.join('\n')}
};
`;

fs.writeFileSync(path.join(generated, 'modules.ts'), modulesTs, 'utf8');
console.log(`homepage-api prepare: ok (${moduleIds.length} module(s), ${routes.length} route(s))`);
