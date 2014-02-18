import {
    CVO_DIAGNOSTIC_SCHEMA,
    CVO_RESULT_SCHEMA,
    CVO_TRANSPORT_SCHEMA,
    type CvoInvocation,
    type CvoResult,
    type CvoTransportEnvelope,
} from '@cvo/core';

export type CvoRequestHandler = (invocation: CvoInvocation) => Promise<CvoResult> | CvoResult;

export interface CvoServerHostOptions {
    readonly contractId: string;
    readonly handlers: Readonly<Record<string, CvoRequestHandler>>;
}

/** In-process host transport used by Node/Bun/Deno adapters and test hosts. */
export function inProcessTransport(): CvoTransportEnvelope {
    return {
        schema: CVO_TRANSPORT_SCHEMA,
        kind: 'in-process',
    };
}

/**
 * Dispatches an invocation to registered handlers on the current host.
 * Default path: local execution without an HTTP/RPC hop to CVO.
 */
export async function dispatchInvocation(options: CvoServerHostOptions, invocation: CvoInvocation): Promise<CvoResult> {
    if (invocation.contractId !== options.contractId) {
        return {
            schema: CVO_RESULT_SCHEMA,
            status: 400,
            diagnostic: {
                schema: CVO_DIAGNOSTIC_SCHEMA,
                code: 'cvo::server::contract_mismatch',
                messageKey: 'cvo.server.contract_mismatch',
                severity: 'error',
                args: {
                    expected: options.contractId,
                    actual: invocation.contractId,
                },
                requestId: invocation.traceContext.requestId,
            },
        };
    }

    const handler = options.handlers[invocation.operationId];
    if (!handler) {
        return {
            schema: CVO_RESULT_SCHEMA,
            status: 404,
            diagnostic: {
                schema: CVO_DIAGNOSTIC_SCHEMA,
                code: 'cvo::server::operation_not_found',
                messageKey: 'cvo.server.operation_not_found',
                severity: 'error',
                args: { operationId: invocation.operationId },
                requestId: invocation.traceContext.requestId,
            },
        };
    }

    return handler(invocation);
}

export interface CvoServerHost {
    readonly contractId: string;
    readonly transport: CvoTransportEnvelope;
    dispatch(invocation: CvoInvocation): Promise<CvoResult>;
}

/** Creates a local server host that executes invocations in-process. */
export function createServerHost(options: CvoServerHostOptions): CvoServerHost {
    const transport = inProcessTransport();
    return {
        contractId: options.contractId,
        transport,
        dispatch(invocation) {
            return dispatchInvocation(options, invocation);
        },
    };
}
