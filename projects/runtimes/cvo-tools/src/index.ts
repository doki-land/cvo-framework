import { contractCatalog } from '@cvo/core';

export { contractCatalog } from '@cvo/core';
export { createNodeFetchHandler, createServerHost } from '@cvo/server';

export function printContractCatalog(): void {
    const catalog = contractCatalog();
    process.stdout.write(`${JSON.stringify(catalog, null, 2)}\n`);
}
