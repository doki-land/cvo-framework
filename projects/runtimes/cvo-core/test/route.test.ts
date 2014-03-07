import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRouteTable, decodeRouteBody, decodeRouteQuery, matchRoute } from '@cvo/core';

const table = createRouteTable('cvo.preview.v1', [
    { operationId: 'health', method: 'GET', path: '/health', body: 'none' },
    {
        operationId: 'getData',
        method: 'GET',
        path: '/data/:id',
        query: [{ name: 'limit', required: false }],
        body: 'none',
    },
]);

test('matchRoute resolves static and param paths', () => {
    const health = matchRoute(table, 'GET', '/health');
    assert.equal(health?.route.operationId, 'health');

    const data = matchRoute(table, 'GET', '/data/item-42');
    assert.equal(data?.route.operationId, 'getData');
    assert.deepEqual(data?.pathParams, { id: 'item-42' });

    assert.equal(matchRoute(table, 'POST', '/health'), undefined);
    assert.equal(matchRoute(table, 'GET', '/missing'), undefined);
});

test('decodeRouteQuery requires declared query params', () => {
    const route = table.routes[1]!;
    const ok = decodeRouteQuery(new URLSearchParams('limit=5'), route);
    assert.equal(ok.ok, true);
    if (ok.ok) {
        assert.deepEqual(ok.query, { limit: '5' });
    }
});

test('decodeRouteBody rejects non-json when json expected', async () => {
    const route = { operationId: 'x', method: 'POST' as const, path: '/x', body: 'json' as const };
    const request = new Request('http://localhost/x', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'hello',
    });
    const decoded = await decodeRouteBody(request, route);
    assert.equal(decoded.ok, false);
});
