import {
    CVO_DIAGNOSTIC_SCHEMA,
    CVO_RESULT_SCHEMA,
    CVO_TRACE_CONTEXT_SCHEMA,
    type CvoInvocation,
    type CvoResult,
    validateInvocationShape,
} from '@cvo/core';
import type { CvoServerHost } from './host.js';

export interface NodeFetchHandlerOptions {
    readonly host: CvoServerHost;
}

function jsonResponse(result: CvoResult): Response {
    const headers = new Headers(result.headers);
    if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json; charset=utf-8');
    }
    return Response.json(result, { status: result.status, headers });
}

function diagnosticResult(status: number, diagnostic: NonNullable<CvoResult['diagnostic']>): CvoResult {
    return {
        schema: CVO_RESULT_SCHEMA,
        status,
        diagnostic,
    };
}

/**
 * Minimal Fetch handler for Node 20+ / Bun / Deno.
 * Accepts POST JSON invocations; keeps execution on the local host by default.
 */
export function createNodeFetchHandler(options: NodeFetchHandlerOptions): (request: Request) => Promise<Response> {
    return async (request) => {
        if (request.method !== 'POST') {
            return jsonResponse(
                diagnosticResult(405, {
                    schema: CVO_DIAGNOSTIC_SCHEMA,
                    code: 'cvo::server::method_not_allowed',
                    messageKey: 'cvo.server.method_not_allowed',
                    severity: 'error',
                    args: { method: request.method },
                }),
            );
        }

        let payload: unknown;
        try {
            payload = await request.json();
        } catch {
            return jsonResponse(
                diagnosticResult(400, {
                    schema: CVO_DIAGNOSTIC_SCHEMA,
                    code: 'cvo::server::invalid_json',
                    messageKey: 'cvo.server.invalid_json',
                    severity: 'error',
                }),
            );
        }

        const checked = validateInvocationShape(payload);
        if (!checked.ok) {
            return jsonResponse(diagnosticResult(400, checked.diagnostic));
        }

        const invocation: CvoInvocation = {
            ...checked.invocation,
            transport: options.host.transport,
            traceContext: {
                schema: CVO_TRACE_CONTEXT_SCHEMA,
                requestId: checked.invocation.traceContext?.requestId ?? crypto.randomUUID(),
                traceId: checked.invocation.traceContext?.traceId,
                spanId: checked.invocation.traceContext?.spanId,
            },
        };

        const result = await options.host.dispatch(invocation);
        return jsonResponse(result);
    };
}
