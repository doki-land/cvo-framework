/**
 * Static check: Worker entry sources must not import Node-only modules.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SERVER_SRC = path.join(ROOT, 'projects/runtimes/cvo-server/src');

const WORKER_FILES = [
    'worker.ts',
    'worker-routes.ts',
    'http-response.ts',
    'preview-routes.ts',
    'preview-server-artifact.ts',
    'server-artifact-adapter.ts',
    'server-artifact-host.ts',
    'server-artifact-modules.ts',
    'host.ts',
    'test-host.ts',
];

const FORBIDDEN = [
    /from\s+['"]node:/,
    /from\s+['"]fs['"]/,
    /from\s+['"]path['"]/,
    /from\s+['"]child_process['"]/,
    /require\s*\(/,
    /from\s+['"]\.\/node\.js['"]/,
    /from\s+['"]\.\/fetch\.js['"]/,
];

function fail(msg) {
    console.error(`check-worker-imports: ${msg}`);
    process.exit(1);
}

let violations = 0;

for (const file of WORKER_FILES) {
    const full = path.join(SERVER_SRC, file);
    if (!fs.existsSync(full)) {
        fail(`missing ${file}`);
    }
    const text = fs.readFileSync(full, 'utf8');
    for (const pattern of FORBIDDEN) {
        if (pattern.test(text)) {
            console.error(`  forbidden ${pattern} in ${file}`);
            violations += 1;
        }
    }
}

if (violations > 0) {
    fail(`${violations} forbidden import pattern(s) in worker-safe sources`);
}

console.log(`check-worker-imports: ok (${WORKER_FILES.length} files)`);
