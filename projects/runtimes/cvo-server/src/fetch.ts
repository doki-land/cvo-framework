import {
    CVO_DIAGNOSTIC_SCHEMA,
    CVO_RESULT_SCHEMA,
    CVO_TRACE_CONTEXT_SCHEMA,
    type CvoInvocation,
    type CvoResult,
    executeInvocation,
    toPublicDiagnostic,
} from '@cvo/core';
import { httpFetchTransport } from './test-host.js';

export interface FetchHandlerHost {
    readonly contractId: string;
    readonly availableCapabilities?: readonly string[];
    dispatch(invocation: CvoInvocation): Promise<CvoResult>;
}

export interface FetchHandlerOptions {
    readonly host: FetchHandlerHost;
    readonly route?: string;
}

export function resultToFetchResponse(result: CvoResult): Response {
    const headers = new Headers(result.headers);
    if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json; charset=utf-8');
    }
    const body = {
        schema: result.schema,
        status: result.status,
        body: result.body,
        diagnostic: result.diagnostic ? toPublicDiagnostic(result.diagnostic) : undefined,
        headers: result.headers,
    };
    return Response.json(body, { status: result.status, headers });
}

function diagnosticResult(status: number, diagnostic: NonNullable<CvoResult['diagnostic']>): CvoResult {
    return {
        schema: CVO_RESULT_SCHEMA,
        status,
        diagnostic,
    };
}

/**
 * Worker-style / Node Fetch handler.
 * POST JSON invocation -> execution graph -> JSON result response.
 */
export function createFetchHandler(options: FetchHandlerOptions): (request: Request) => Promise<Response> {
    const transport = httpFetchTransport(options.route);

    return async (request) => {
        if (request.method !== 'POST') {
            return resultToFetchResponse(
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
            return resultToFetchResponse(
                diagnosticResult(400, {
                    schema: CVO_DIAGNOSTIC_SCHEMA,
                    code: 'cvo::server::invalid_json',
                    messageKey: 'cvo.server.invalid_json',
                    severity: 'error',
                }),
            );
        }

        const outcome = await executeInvocation({
            raw: payload,
            contractId: options.host.contractId,
            availableCapabilities: options.host.availableCapabilities ?? [],
            supportedTransports: ['http-fetch', 'in-process'],
            handler: async (invocation) =>
                options.host.dispatch({
                    ...invocation,
                    transport,
                    traceContext: {
                        schema: CVO_TRACE_CONTEXT_SCHEMA,
                        requestId: invocation.traceContext?.requestId ?? crypto.randomUUID(),
                        traceId: invocation.traceContext?.traceId ?? request.headers.get('traceparent')?.split('-')[1],
                        spanId: invocation.traceContext?.spanId ?? request.headers.get('x-span-id') ?? undefined,
                    },
                }),
        });

        return resultToFetchResponse(outcome.result);
    };
}
