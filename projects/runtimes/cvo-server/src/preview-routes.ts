import { CVO_RESULT_SCHEMA, type CvoInvocation, type CvoResult, type CvoRouteTable, createRouteTable } from '@cvo/core';
import type { CvoRequestHandler } from './host.js';
import { CVO_PREVIEW_CONTRACT_ID, httpFetchTransport } from './test-host.js';

export { CVO_PREVIEW_CONTRACT_ID, httpFetchTransport };

/** Static route table for 0.0.2 preview Worker vertical slice. */
export function createPreviewRouteTable(contractId = CVO_PREVIEW_CONTRACT_ID): CvoRouteTable {
    return createRouteTable(contractId, [
        {
            operationId: 'health',
            method: 'GET',
            path: '/health',
            body: 'none',
        },
        {
            operationId: 'getData',
            method: 'GET',
            path: '/data/:id',
            query: [{ name: 'limit', required: false }],
            body: 'none',
        },
    ]);
}

/** Route handlers for preview conformance (health + typed data). */
export function createPreviewRouteHandlers(contractId: string): Readonly<Record<string, CvoRequestHandler>> {
    return {
        health: async (): Promise<CvoResult> => ({
            schema: CVO_RESULT_SCHEMA,
            status: 200,
            body: {
                ok: true,
                service: contractId,
            },
        }),
        getData: async (invocation: CvoInvocation): Promise<CvoResult> => {
            const input = invocation.input as {
                path?: { id?: string };
                query?: { limit?: string };
            };
            const id = input.path?.id ?? '';
            const limitRaw = input.query?.limit;
            const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 10;
            return {
                schema: CVO_RESULT_SCHEMA,
                status: 200,
                body: {
                    id,
                    limit: Number.isFinite(limit) ? limit : 10,
                    items: [`item-${id}-1`, `item-${id}-2`],
                },
            };
        },
    };
}
