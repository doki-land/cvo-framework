import {
    CVO_CAPABILITY_MANIFEST_SCHEMA,
    CVO_INVOCATION_SCHEMA,
    CVO_RESULT_SCHEMA,
    CVO_TRACE_CONTEXT_SCHEMA,
    CVO_TRANSPORT_SCHEMA,
    type CvoInvocation,
    type CvoResult,
    contractCatalog,
} from '@cvo/core';
import { createNodeFetchHandler, createServerHost } from '@cvo/server';

const CONTRACT_ID = 'cvo.homepage.v1';

function json(data: unknown, status = 200): Response {
    return Response.json(data, {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
    });
}

const host = createServerHost({
    contractId: CONTRACT_ID,
    handlers: {
        health: async (): Promise<CvoResult> => ({
            schema: CVO_RESULT_SCHEMA,
            status: 200,
            body: {
                ok: true,
                protocol: contractCatalog().protocol,
                contractId: CONTRACT_ID,
            },
        }),
        catalog: async (): Promise<CvoResult> => ({
            schema: CVO_RESULT_SCHEMA,
            status: 200,
            body: contractCatalog(),
        }),
    },
});

const invoke = createNodeFetchHandler({ host });

interface Env {
    ASSETS: Fetcher;
    CVO_CONTRACT_ID?: string;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === '/api/health') {
            if (request.method !== 'GET') {
                return json({ code: 'method_not_allowed' }, 405);
            }
            return json({
                ok: true,
                protocol: contractCatalog().protocol,
                contractId: env.CVO_CONTRACT_ID ?? CONTRACT_ID,
            });
        }

        if (url.pathname === '/api/catalog') {
            if (request.method !== 'GET') {
                return json({ code: 'method_not_allowed' }, 405);
            }
            return json(contractCatalog());
        }

        if (url.pathname === '/api/invoke') {
            return invoke(request);
        }

        if (url.pathname.startsWith('/api/')) {
            return json({ code: 'not_found' }, 404);
        }

        return env.ASSETS.fetch(request);
    },
};

/** Example invocation envelope for conformance hosts and tests. */
export function exampleHealthInvocation(requestId: string): CvoInvocation {
    return {
        schema: CVO_INVOCATION_SCHEMA,
        contractId: CONTRACT_ID,
        operationId: 'health',
        transport: { schema: CVO_TRANSPORT_SCHEMA, kind: 'http-fetch', method: 'POST', route: '/api/invoke' },
        input: {},
        capabilities: { schema: CVO_CAPABILITY_MANIFEST_SCHEMA, requirements: [] },
        traceContext: { schema: CVO_TRACE_CONTEXT_SCHEMA, requestId },
    };
}
