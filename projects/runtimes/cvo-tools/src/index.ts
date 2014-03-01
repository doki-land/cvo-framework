import { contractCatalog } from '@cvo/core';

export { contractCatalog } from '@cvo/core';
export { createNodeFetchHandler, createPreviewTestHost, createServerHost } from '@cvo/server';
export { runCli } from './cli.js';
export { inspectFixtureFile, replayAllFixtures, validateAllFixtures, validateFixtureFile } from './preview.js';

export function printContractCatalog(): void {
    const catalog = contractCatalog();
    process.stdout.write(`${JSON.stringify(catalog, null, 2)}\n`);
}
