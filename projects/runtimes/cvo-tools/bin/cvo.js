#!/usr/bin/env node

import { printContractCatalog } from '../dist/index.js';

const [command] = process.argv.slice(2);

switch (command) {
    case 'contract':
    case 'catalog':
        printContractCatalog();
        break;
    case '--help':
    case '-h':
    case undefined:
        process.stdout.write(
            ['CVO — edge-native application backend', '', 'Usage:', '  cvo catalog    Print cvo-contract-v1 schema catalog', ''].join('\n'),
        );
        break;
    default:
        process.stderr.write(`Unknown command: ${command}\n`);
        process.exitCode = 1;
}
