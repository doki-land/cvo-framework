import {
    buildRouteInput,
    CVO_CAPABILITY_MANIFEST_SCHEMA,
    CVO_DIAGNOSTIC_SCHEMA,
    CVO_INVOCATION_SCHEMA,
    CVO_RESULT_SCHEMA,
    CVO_TRACE_CONTEXT_SCHEMA,
    CVO_TRANSPORT_SCHEMA,
    type CvoDiagnostic,
    type CvoInvocation,
    type CvoResult,
    type CvoRouteTable,
    decodeRouteBody,
    decodeRouteQuery,
    executeInvocation,
    matchRoute,
    toPublicDiagnostic,
} from '@cvo/core';
import type { CvoRequestHandler } from './host.js';
import { errorHttpResponse, resultToHttpResponse } from './http-response.js';
import { httpFetchTransport } from './test-host.js';

export interface CvoRouteFetchServiceOptions {
    readonly routeTable: CvoRouteTable;
    readonly handlers: Readonly<Record<string, CvoRequestHandler>>;
    readonly availableCapabilities?: readonly string[];
    readonly defaultTimeoutMs?: number;
}

function notFoundDiagnostic(pathname: string, method: string): CvoResult {
    return {
        schema: CVO_RESULT_SCHEMA,
        status: 404,
        diagnostic: {
            schema: CVO_DIAGNOSTIC_SCHEMA,
            code: 'cvo::route::not_found',
            messageKey: 'cvo.route.not_found',
            severity: 'error',
            args: { pathname, method },
        },
    };
}

function traceFromRequest(request: Request): { requestId: string; traceId?: string; spanId?: string } {
    return {
        requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(),
        traceId: request.headers.get('traceparent')?.split('-')[1],
        spanId: request.headers.get('x-span-id') ?? undefined,
    };
}

function buildInvocation(
    table: CvoRouteTable,
    request: Request,
    match: NonNullable<ReturnType<typeof matchRoute>>,
    query: Readonly<Record<string, string>>,
    body: unknown,
    pathname: string,
): CvoInvocation {
    const trace = traceFromRequest(request);
    return {
        schema: CVO_INVOCATION_SCHEMA,
        contractId: table.contractId,
        operationId: match.route.operationId,
        transport: {
            ...httpFetchTransport(pathname, match.route.method),
            schema: CVO_TRANSPORT_SCHEMA,
        },
        input: buildRouteInput(match, query, body),
        capabilities: { schema: CVO_CAPABILITY_MANIFEST_SCHEMA, requirements: [] },
        traceContext: {
            schema: CVO_TRACE_CONTEXT_SCHEMA,
            requestId: trace.requestId,
            traceId: trace.traceId,
            spanId: trace.spanId,
        },
        deadline: request.headers.get('x-deadline') ?? undefined,
    };
}

/** Run handler with abort signal and optional timeout. */
export async function invokeWithAbort<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<T> {
    const controller = new AbortController();
    const parent = options?.signal;
    if (parent?.aborted) {
        controller.abort(parent.reason);
    } else if (parent) {
        parent.addEventListener('abort', () => controller.abort(parent.reason), { once: true });
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    let timeoutError: Error | undefined;

    const abortPromise = new Promise<never>((_resolve, reject) => {
        const onAbort = () => {
            const reason = controller.signal.reason;
            if (reason instanceof Error) {
                reject(reason);
                return;
            }
            reject(timeoutError ?? new Error('aborted'));
        };
        if (controller.signal.aborted) {
            onAbort();
            return;
        }
        controller.signal.addEventListener('abort', onAbort, { once: true });
    });

    if (options?.timeoutMs !== undefined && options.timeoutMs > 0) {
        timer = setTimeout(() => {
            timeoutError = new Error('timeout');
            controller.abort(timeoutError);
        }, options.timeoutMs);
    }

    try {
        return await Promise.race([fn(controller.signal), abortPromise]);
    } finally {
        if (timer !== undefined) {
            clearTimeout(timer);
        }
    }
}

/**
 * Worker-safe Fetch service: static route table -> decode -> execution graph -> HTTP response.
 * Uses Web Request/Response/Headers only.
 */
export function createRouteFetchService(options: CvoRouteFetchServiceOptions): (request: Request) => Promise<Response> {
    const timeoutMs = options.defaultTimeoutMs ?? 30_000;

    return async (request) => {
        const url = new URL(request.url);
        const matched = matchRoute(options.routeTable, request.method, url.pathname);
        if (!matched) {
            return resultToHttpResponse(notFoundDiagnostic(url.pathname, request.method));
        }

        const queryDecoded = decodeRouteQuery(url.searchParams, matched.route);
        if (!queryDecoded.ok) {
            return errorHttpResponse(toPublicDiagnostic(queryDecoded.diagnostic), 400);
        }

        const bodyDecoded = await decodeRouteBody(request, matched.route);
        if (!bodyDecoded.ok) {
            return errorHttpResponse(toPublicDiagnostic(bodyDecoded.diagnostic), 400);
        }

        const invocation = buildInvocation(options.routeTable, request, matched, queryDecoded.query, bodyDecoded.body, url.pathname);

        const handler = options.handlers[matched.route.operationId];
        if (!handler) {
            return resultToHttpResponse({
                schema: CVO_RESULT_SCHEMA,
                status: 404,
                diagnostic: {
                    schema: CVO_DIAGNOSTIC_SCHEMA,
                    code: 'cvo::server::operation_not_found',
                    messageKey: 'cvo.server.operation_not_found',
                    severity: 'error',
                    args: { operationId: matched.route.operationId },
                    requestId: invocation.traceContext.requestId,
                },
            });
        }

        try {
            const outcome = await invokeWithAbort(
                async (signal) => {
                    if (signal.aborted) {
                        throw signal.reason ?? new Error('aborted');
                    }
                    return executeInvocation({
                        raw: invocation,
                        contractId: options.routeTable.contractId,
                        availableCapabilities: options.availableCapabilities ?? [],
                        supportedTransports: ['http-fetch', 'in-process'],
                        handler: async (inv) => {
                            if (signal.aborted) {
                                throw signal.reason ?? new Error('aborted');
                            }
                            return handler(inv);
                        },
                    });
                },
                { signal: request.signal, timeoutMs },
            );

            return resultToHttpResponse(outcome.result);
        } catch (error) {
            const aborted = error instanceof Error && (error.message === 'timeout' || error.message === 'aborted');
            const diagnostic: CvoDiagnostic = {
                schema: CVO_DIAGNOSTIC_SCHEMA,
                code: aborted ? 'cvo::route::aborted' : 'cvo::contract::handler_threw',
                messageKey: aborted ? 'cvo.route.aborted' : 'cvo.contract.handler_threw',
                severity: 'error',
                args: { message: error instanceof Error ? error.message : String(error) },
                requestId: invocation.traceContext.requestId,
            };
            return errorHttpResponse(diagnostic, aborted ? 504 : 500);
        }
    };
}
