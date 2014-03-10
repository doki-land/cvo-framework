import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CVO_RESULT_SCHEMA, validateServerArtifact, vmzOperationId } from '@cvo/core';
import {
    createPreviewRouteHandlers,
    createPreviewServerArtifact,
    createServerArtifactFetchService,
    loadServerArtifact,
    serverArtifactHostDiagnostics,
    serverArtifactToRouteTable,
} from '@cvo/server';

const fixtureDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../cvo-core/specifications/fixtures/server-artifact');

function loadSampleArtifact() {
    return loadServerArtifact(JSON.parse(readFileSync(path.join(fixtureDir, 'sample-server-artifact.json'), 'utf8')) as unknown);
}

test('serverArtifactToRouteTable maps public routes', () => {
    const artifact = createPreviewServerArtifact();
    const table = serverArtifactToRouteTable(artifact);
    assert.equal(table.routes.length, 2);
    assert.equal(table.routes[0]?.operationId, vmzOperationId('#server/preview/Health', 'health'));
});

test('createServerArtifactFetchService serves health and data routes', async () => {
    const artifact = createPreviewServerArtifact();
    const handlers = createPreviewRouteHandlers('cvo.preview.v1');
    const mapped: Record<string, typeof handlers.health> = {
        [vmzOperationId('#server/preview/Health', 'health')]: handlers.health!,
        [vmzOperationId('#server/preview/Data', 'getData')]: async (invocation) => {
            const input = invocation.input as { path?: { id?: string }; query?: { limit?: string } };
            const id = input.path?.id ?? '';
            const limit = input.query?.limit ? Number.parseInt(input.query.limit, 10) : 10;
            return {
                schema: CVO_RESULT_SCHEMA,
                status: 200,
                body: { id, limit, items: [`item-${id}-1`] },
            };
        },
    };

    const service = createServerArtifactFetchService({
        artifact,
        handlers: mapped,
        hostProfile: 'test-host',
        availableCapabilities: ['cvo.logging'],
    });

    const health = await service(new Request('http://localhost/health'));
    assert.equal(health.status, 200);

    const data = await service(new Request('http://localhost/data/widget?limit=2'));
    assert.equal(data.status, 200);
    const body = (await data.json()) as { body?: { id?: string; limit?: number } };
    assert.equal(body.body?.id, 'widget');
    assert.equal(body.body?.limit, 2);
});

test('serverArtifactHostDiagnostics lists secret ids without values', () => {
    const artifact = loadSampleArtifact();
    const diag = serverArtifactHostDiagnostics(artifact, 'test-host');
    assert.equal(diag.artifactValid, true);
    assert.deepEqual(diag.secretRequirementIds, ['PREVIEW_KV']);
    assert.ok(diag.internalCapabilityIds.some((id) => id.includes('fetchUser')));
});

test('validateServerArtifact fixture rejects tampered schema', () => {
    const raw = JSON.parse(readFileSync(path.join(fixtureDir, 'sample-server-artifact.json'), 'utf8')) as Record<string, unknown>;
    raw.schema = 'vmz.server.artifact.v1';
    const decision = validateServerArtifact(raw);
    assert.equal(decision.ok, false);
});
