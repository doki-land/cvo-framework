import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CVO_RESULT_SCHEMA, vmzOperationId } from '@cvo/core';
import {
    createPreviewServerArtifact,
    createServerArtifactFetchService,
    createServerArtifactModuleHandlers,
} from '@cvo/server';

test('createServerArtifactModuleHandlers invokes compiled-style class methods', async () => {
    const artifact = createPreviewServerArtifact();
    class Health {
        async health() {
            return { ok: true, surface: 'module-handler' };
        }
    }
    class Data {
        async getData() {
            return { items: [1] };
        }
    }

    const handlers = createServerArtifactModuleHandlers(artifact, async (moduleId) => {
        if (moduleId === '#server/preview/Health') {
            return { default: Health };
        }
        if (moduleId === '#server/preview/Data') {
            return { default: Data };
        }
        throw new Error(moduleId);
    });

    const service = createServerArtifactFetchService({
        artifact,
        handlers,
        hostProfile: 'test-host',
        availableCapabilities: ['cvo.logging'],
        httpBodyMode: 'vmz-json',
    });

    const health = await service(new Request('http://localhost/health'));
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true, surface: 'module-handler' });

    const data = await service(new Request('http://localhost/data/x?limit=1'));
    assert.equal(data.status, 200);
    assert.deepEqual(await data.json(), { items: [1] });

    assert.ok(handlers[vmzOperationId('#server/preview/Health', 'health')]);
});

test('httpBodyMode cvo-envelope wraps module handler body', async () => {
    const artifact = createPreviewServerArtifact();
    class Health {
        async health() {
            return { ok: true };
        }
    }
    const handlers = createServerArtifactModuleHandlers(artifact, async () => ({ default: Health }));
    const service = createServerArtifactFetchService({
        artifact,
        handlers: {
            [vmzOperationId('#server/preview/Health', 'health')]: handlers[vmzOperationId('#server/preview/Health', 'health')]!,
        },
        hostProfile: 'test-host',
        httpBodyMode: 'cvo-envelope',
    });
    const health = await service(new Request('http://localhost/health'));
    const body = (await health.json()) as { schema?: string; body?: { ok?: boolean } };
    assert.equal(body.schema, CVO_RESULT_SCHEMA);
    assert.equal(body.body?.ok, true);
});
