import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    CVO_CAPABILITY_MANIFEST_SCHEMA,
    CVO_DIAG_CAPABILITY_MISSING,
    CVO_DIAG_INVOCATION_INVALID,
    CVO_INVOCATION_SCHEMA,
    CVO_TRACE_CONTEXT_SCHEMA,
    CVO_TRANSPORT_SCHEMA,
    type CvoInvocation,
    type CvoResult,
    executeInvocation,
    replayFixture,
    runValidateFixture,
    validateReplayFixtureShape,
    validateValidateFixtureShape,
} from '@cvo/core';

const fixtureDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../specifications/fixtures');

function loadFixture(name: string): unknown {
    return JSON.parse(readFileSync(path.join(fixtureDir, name), 'utf8')) as unknown;
}

const previewHandler = async (invocation: CvoInvocation): Promise<CvoResult> => {
    if (invocation.operationId === 'health') {
        return {
            schema: 'cvo.result.v1',
            status: 200,
            body: { ok: true, service: 'cvo.preview.v1' },
        };
    }
    if (invocation.operationId === 'echo') {
        return {
            schema: 'cvo.result.v1',
            status: 200,
            body: invocation.input,
        };
    }
    return {
        schema: 'cvo.result.v1',
        status: 404,
        diagnostic: {
            schema: 'cvo.diagnostic.v1',
            code: 'cvo::test::not_found',
            messageKey: 'cvo.test.not_found',
            severity: 'error',
        },
    };
};

test('execution graph runs decode -> validate -> capability_check -> invoke -> encode', async () => {
    const invocation = {
        schema: CVO_INVOCATION_SCHEMA,
        contractId: 'cvo.preview.v1',
        operationId: 'health',
        transport: { schema: CVO_TRANSPORT_SCHEMA, kind: 'in-process' as const },
        input: {},
        capabilities: { schema: CVO_CAPABILITY_MANIFEST_SCHEMA, requirements: [] },
        traceContext: { schema: CVO_TRACE_CONTEXT_SCHEMA, requestId: 'test-001' },
    };

    const outcome = await executeInvocation({
        raw: invocation,
        contractId: 'cvo.preview.v1',
        handler: previewHandler,
    });

    assert.equal(outcome.trace.stages.map((s) => s.stage).join(','), 'decode,validate,capability_check,invoke,encode');
    assert.equal(outcome.result.status, 200);
    assert.equal(outcome.ok, true);
});

test('missing capability fails closed at capability_check', async () => {
    const fixture = validateValidateFixtureShape(loadFixture('validate-missing-capability.json'));
    assert.equal(fixture.ok, true);
    const result = await runValidateFixture(fixture.fixture);
    assert.equal(result.ok, true);
    assert.equal(result.diagnosticCode, CVO_DIAG_CAPABILITY_MISSING);
});

test('invalid envelope fails at validate', async () => {
    const fixture = validateValidateFixtureShape(loadFixture('validate-invalid-envelope.json'));
    assert.equal(fixture.ok, true);
    const result = await runValidateFixture(fixture.fixture);
    assert.equal(result.ok, true);
    assert.equal(result.diagnosticCode, CVO_DIAG_INVOCATION_INVALID);
});

test('replay in-process fixtures match expectations', async () => {
    for (const file of ['replay-health-in-process.json', 'replay-echo-in-process.json']) {
        const checked = validateReplayFixtureShape(loadFixture(file));
        assert.equal(checked.ok, true);
        const replay = await replayFixture(checked.fixture, previewHandler);
        assert.equal(replay.match.ok, true, `${file}: ${replay.match.diffs.join('; ')}`);
    }
});

test('deadline exceeded fails at validate', async () => {
    const invocation = {
        schema: CVO_INVOCATION_SCHEMA,
        contractId: 'cvo.preview.v1',
        operationId: 'health',
        transport: { schema: CVO_TRANSPORT_SCHEMA, kind: 'in-process' as const },
        input: {},
        capabilities: { schema: CVO_CAPABILITY_MANIFEST_SCHEMA, requirements: [] },
        traceContext: { schema: CVO_TRACE_CONTEXT_SCHEMA, requestId: 'deadline-001' },
        deadline: '2000-01-01T00:00:00.000Z',
    };

    const outcome = await executeInvocation({
        raw: invocation,
        contractId: 'cvo.preview.v1',
        now: () => Date.parse('2026-01-01T00:00:00.000Z'),
        skipInvoke: true,
    });

    assert.equal(outcome.result.diagnostic?.code, 'cvo::contract::deadline_exceeded');
});
