import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateReplayFixtureShape } from '@cvo/core';
import { createFetchHandler, createPreviewTestHost } from '@cvo/server';

const fixtureDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../cvo-core/specifications/fixtures');

function loadFixture(name: string): unknown {
    return JSON.parse(readFileSync(path.join(fixtureDir, name), 'utf8')) as unknown;
}

test('in-process test host replays preview fixtures', async () => {
    const host = createPreviewTestHost();
    for (const file of ['replay-health-in-process.json', 'replay-echo-in-process.json']) {
        const checked = validateReplayFixtureShape(loadFixture(file));
        assert.equal(checked.ok, true);
        const replay = await host.replay(checked.fixture);
        assert.equal(replay.match.ok, true, `${file}: ${replay.match.diffs.join('; ')}`);
    }
});

test('fetch handler replays http-fetch fixture with same result as in-process', async () => {
    const host = createPreviewTestHost();
    const fetchHandler = createFetchHandler({
        host: {
            contractId: host.contractId,
            availableCapabilities: [...host.availableCapabilities],
            dispatch: (invocation) => host.dispatch(invocation),
        },
    });

    const checked = validateReplayFixtureShape(loadFixture('replay-health-http-fetch.json'));
    assert.equal(checked.ok, true);

    const inProcess = await host.replay(checked.fixture);

    const response = await fetchHandler(
        new Request('http://localhost/invoke', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(checked.fixture.invocation),
        }),
    );
    const fetchEnvelope = (await response.json()) as { status: number; body?: unknown };

    assert.equal(fetchEnvelope.status, inProcess.outcome.result.status);
    assert.deepEqual(fetchEnvelope.body, inProcess.outcome.result.body);
    assert.equal(inProcess.match.ok, true);
});

test('fetch handler rejects non-POST methods', async () => {
    const host = createPreviewTestHost();
    const fetchHandler = createFetchHandler({
        host: {
            contractId: host.contractId,
            availableCapabilities: [],
            dispatch: (invocation) => host.dispatch(invocation),
        },
    });

    const response = await fetchHandler(new Request('http://localhost/invoke', { method: 'GET' }));
    assert.equal(response.status, 405);
});
