import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type CvoReplayFixture, formatExecutionReport, loadFixtureDocument, parseFixtureJson, runValidateFixture } from '@cvo/core';
import { createPreviewTestHost } from '@cvo/server';

export function readFixtureFile(filePath: string): unknown {
    const text = fs.readFileSync(filePath, 'utf8');
    return parseFixtureJson(text);
}

export async function inspectFixtureFile(filePath: string): Promise<{ ok: boolean; report: string }> {
    const loaded = loadFixtureDocument(readFixtureFile(filePath));
    const host = createPreviewTestHost();

    if (loaded.kind === 'replay') {
        const replay = await host.replay(loaded.fixture);
        const report = formatExecutionReport(replay.outcome);
        return { ok: replay.match.ok, report };
    }

    if (loaded.kind === 'validate') {
        const result = await runValidateFixture(loaded.fixture);
        const outcome = await host.executeRaw(loaded.fixture.invocation);
        const report = formatExecutionReport(outcome);
        return { ok: result.ok, report };
    }

    if (loaded.kind === 'invocation') {
        const outcome = await host.executeRaw(loaded.invocation);
        return { ok: outcome.ok, report: formatExecutionReport(outcome) };
    }

    return { ok: false, report: JSON.stringify({ error: loaded.message }, null, 2) };
}

export async function validateFixtureFile(filePath: string): Promise<{ ok: boolean; message: string }> {
    const loaded = loadFixtureDocument(readFixtureFile(filePath));

    if (loaded.kind === 'validate') {
        const result = await runValidateFixture(loaded.fixture);
        return {
            ok: result.ok,
            message: result.ok
                ? `validate ok: ${loaded.fixture.name}`
                : `validate failed: ${loaded.fixture.name} (code=${result.diagnosticCode ?? 'unknown'})`,
        };
    }

    if (loaded.kind === 'replay') {
        const host = createPreviewTestHost();
        const replay = await host.replay(loaded.fixture);
        return {
            ok: replay.match.ok,
            message: replay.match.ok
                ? `replay ok: ${loaded.fixture.name}`
                : `replay failed: ${loaded.fixture.name} (${replay.match.diffs.join('; ')})`,
        };
    }

    if (loaded.kind === 'invocation') {
        const host = createPreviewTestHost();
        const outcome = await host.executeRaw(loaded.invocation);
        return {
            ok: outcome.ok,
            message: outcome.ok ? 'invocation ok' : `invocation failed: ${outcome.result.diagnostic?.code ?? 'unknown'}`,
        };
    }

    return { ok: false, message: `invalid fixture: ${loaded.message}` };
}

export function defaultFixtureDir(): string {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(here, '../../cvo-core/specifications/fixtures');
}

export async function validateAllFixtures(dir = defaultFixtureDir()): Promise<{ ok: boolean; results: string[] }> {
    const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json'));
    const results: string[] = [];
    let ok = true;
    for (const file of files.sort()) {
        const result = await validateFixtureFile(path.join(dir, file));
        results.push(`${result.ok ? 'ok' : 'fail'}  ${file}  ${result.message}`);
        if (!result.ok) {
            ok = false;
        }
    }
    return { ok, results };
}

export async function replayAllFixtures(dir = defaultFixtureDir()): Promise<{ ok: boolean; results: string[] }> {
    const host = createPreviewTestHost();
    const files = fs
        .readdirSync(dir)
        .filter((name) => name.startsWith('replay-') && name.endsWith('.json'))
        .sort();
    const results: string[] = [];
    let ok = true;
    for (const file of files) {
        const loaded = loadFixtureDocument(readFixtureFile(path.join(dir, file)));
        if (loaded.kind !== 'replay') {
            results.push(`fail  ${file}  not a replay fixture`);
            ok = false;
            continue;
        }
        const replay = await host.replay(loaded.fixture as CvoReplayFixture);
        const line = replay.match.ok ? `ok    ${file}  ${loaded.fixture.name}` : `fail  ${file}  ${replay.match.diffs.join('; ')}`;
        results.push(line);
        if (!replay.match.ok) {
            ok = false;
        }
    }
    return { ok, results };
}
