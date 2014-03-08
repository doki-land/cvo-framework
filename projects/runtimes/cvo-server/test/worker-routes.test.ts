import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    CVO_PREVIEW_CONTRACT_ID,
    createPreviewRouteHandlers,
    createPreviewRouteTable,
    createRouteFetchService,
    redirectResult,
} from '@cvo/server';

test('route fetch service serves health and typed data routes', async () => {
    const routeTable = createPreviewRouteTable();
    const service = createRouteFetchService({
        routeTable,
        handlers: createPreviewRouteHandlers(CVO_PREVIEW_CONTRACT_ID),
    });

    const health = await service(new Request('http://localhost/health'));
    assert.equal(health.status, 200);
    const healthBody = (await health.json()) as { body?: { ok?: boolean; service?: string } };
    assert.equal(healthBody.body?.ok, true);
    assert.equal(healthBody.body?.service, CVO_PREVIEW_CONTRACT_ID);

    const data = await service(new Request('http://localhost/data/widget?limit=3'));
    assert.equal(data.status, 200);
    const dataBody = (await data.json()) as { body?: { id?: string; limit?: number; items?: string[] } };
    assert.equal(dataBody.body?.id, 'widget');
    assert.equal(dataBody.body?.limit, 3);
    assert.ok(Array.isArray(dataBody.body?.items));
});

test('route fetch service returns 404 for unknown paths', async () => {
    const service = createRouteFetchService({
        routeTable: createPreviewRouteTable(),
        handlers: createPreviewRouteHandlers(CVO_PREVIEW_CONTRACT_ID),
    });
    const response = await service(new Request('http://localhost/unknown'));
    assert.equal(response.status, 404);
});

test('route fetch service times out slow handlers', async () => {
    const routeTable = createPreviewRouteTable();
    const service = createRouteFetchService({
        routeTable,
        handlers: {
            health: async () => {
                await new Promise((resolve) => setTimeout(resolve, 50));
                return {
                    schema: 'cvo.result.v1',
                    status: 200,
                    body: { ok: true },
                };
            },
        },
        defaultTimeoutMs: 5,
    });

    const response = await service(new Request('http://localhost/health'));
    assert.equal(response.status, 504);
});

test('route fetch service returns redirect responses', async () => {
    const service = createRouteFetchService({
        routeTable: createPreviewRouteTable(),
        handlers: {
            health: async () => redirectResult('/data/redirected', 302),
        },
    });

    const response = await service(new Request('http://localhost/health'));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/data/redirected');
});

test('node fetch handler and route service return same health payload', async () => {
    const routeTable = createPreviewRouteTable();
    const handlers = createPreviewRouteHandlers(CVO_PREVIEW_CONTRACT_ID);
    const routeService = createRouteFetchService({ routeTable, handlers });

    const routeResponse = await routeService(new Request('http://localhost/health'));
    const routeJson = (await routeResponse.json()) as { body?: unknown };

    const { createInProcessTestHost } = await import('@cvo/server');
    const host = createInProcessTestHost({
        contractId: CVO_PREVIEW_CONTRACT_ID,
        handlers,
    });
    const inProcess = await host.executeRaw({
        schema: 'cvo.invocation.v1',
        contractId: CVO_PREVIEW_CONTRACT_ID,
        operationId: 'health',
        transport: { schema: 'cvo.transport.v1', kind: 'in-process' },
        input: {},
        capabilities: { schema: 'cvo.capability_manifest.v1', requirements: [] },
        traceContext: { schema: 'cvo.trace_context.v1', requestId: 'parity-001' },
    });

    assert.deepEqual(routeJson.body, inProcess.result.body);
});
