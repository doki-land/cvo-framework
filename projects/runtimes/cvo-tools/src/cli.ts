import { inspectFixtureFile, replayAllFixtures, validateAllFixtures, validateFixtureFile } from './preview.js';

function usage(): string {
    return [
        'CVO — edge-native application backend',
        '',
        'Usage:',
        '  cvo catalog                 Print cvo-contract-v1 schema catalog',
        '  cvo inspect <file>          Run execution graph and print stage trace',
        '  cvo validate <file>         Validate fixture or invocation file',
        '  cvo validate --all          Run all conformance fixtures',
        '  cvo replay --all            Replay preview fixtures (in-process host)',
        '',
    ].join('\n');
}

export async function runCli(argv: readonly string[]): Promise<number> {
    const [command, arg, ...rest] = argv;

    switch (command) {
        case 'catalog':
        case 'contract': {
            const { printContractCatalog } = await import('./index.js');
            printContractCatalog();
            return 0;
        }
        case 'inspect': {
            if (!arg) {
                process.stderr.write('cvo inspect: missing file argument\n');
                return 1;
            }
            const result = await inspectFixtureFile(arg);
            process.stdout.write(`${result.report}\n`);
            return result.ok ? 0 : 1;
        }
        case 'validate': {
            if (arg === '--all') {
                const result = await validateAllFixtures();
                for (const line of result.results) {
                    process.stdout.write(`${line}\n`);
                }
                return result.ok ? 0 : 1;
            }
            if (!arg) {
                process.stderr.write('cvo validate: missing file argument (or use --all)\n');
                return 1;
            }
            const result = await validateFixtureFile(arg);
            process.stdout.write(`${result.message}\n`);
            return result.ok ? 0 : 1;
        }
        case 'replay': {
            if (arg === '--all') {
                const result = await replayAllFixtures();
                for (const line of result.results) {
                    process.stdout.write(`${line}\n`);
                }
                return result.ok ? 0 : 1;
            }
            process.stderr.write('cvo replay: use --all\n');
            return 1;
        }
        case '--help':
        case '-h':
        case undefined:
            process.stdout.write(usage());
            return 0;
        default:
            if (rest.length === 0 && !command) {
                process.stdout.write(usage());
                return 0;
            }
            process.stderr.write(`Unknown command: ${command}\n`);
            process.stderr.write(usage());
            return 1;
    }
}
