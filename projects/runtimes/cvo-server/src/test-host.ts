import {
    CVO_RESULT_SCHEMA,
    CVO_TRANSPORT_SCHEMA,
    type CvoExecutionOutcome,
    type CvoFixtureReplayResult,
    type CvoInvocation,
    type CvoReplayFixture,
    type CvoResult,
    type CvoTransportEnvelope,
    executeInvocation,
    replayFixture,
} from '@cvo/core';
import { type CvoRequestHandler, type CvoServerHostOptions, createServerHost, dispatchInvocation, inProcessTransport } from './host.js';

export const CVO_PREVIEW_CONTRACT_ID = 'cvo.preview.v1';

/** Standard preview handlers used by conformance fixtures. */
export function createPreviewHandlers(contractId: string): Readonly<Record<string, CvoRequestHandler>> {
    return {
        health: async (): Promise<CvoResult> => ({
            schema: CVO_RESULT_SCHEMA,
            status: 200,
            body: {
                ok: true,
                service: contractId,
            },
        }),
        echo: async (invocation: CvoInvocation): Promise<CvoResult> => ({
            schema: CVO_RESULT_SCHEMA,
            status: 200,
            body: invocation.input,
        }),
    };
}

export interface CvoInProcessTestHostOptions extends CvoServerHostOptions {
    readonly availableCapabilities?: readonly string[];
}

export interface CvoInProcessTestHost {
    readonly contractId: string;
    readonly availableCapabilities: readonly string[];
    executeRaw(raw: unknown): Promise<CvoExecutionOutcome>;
    replay(fixture: CvoReplayFixture): Promise<CvoFixtureReplayResult>;
    dispatch(invocation: CvoInvocation): Promise<CvoResult>;
}

/**
 * Deterministic in-process test host for fixture replay.
 * Uses the same execution graph as Fetch hosts without an HTTP hop.
 */
export function createInProcessTestHost(options: CvoInProcessTestHostOptions): CvoInProcessTestHost {
    const host = createServerHost(options);
    const availableCapabilities = options.availableCapabilities ?? [];

    async function executeRaw(raw: unknown): Promise<CvoExecutionOutcome> {
        return executeInvocation({
            raw,
            contractId: options.contractId,
            availableCapabilities,
            supportedTransports: ['in-process', 'http-fetch'],
            handler: (invocation) => dispatchInvocation(options, invocation),
        });
    }

    return {
        contractId: options.contractId,
        availableCapabilities,
        executeRaw,
        replay(fixture) {
            return replayFixture(fixture, (invocation) => dispatchInvocation(options, invocation));
        },
        dispatch(invocation) {
            return host.dispatch(invocation);
        },
    };
}

/** Create a preview test host with standard health/echo handlers. */
export function createPreviewTestHost(contractId = CVO_PREVIEW_CONTRACT_ID): CvoInProcessTestHost {
    return createInProcessTestHost({
        contractId,
        handlers: createPreviewHandlers(contractId),
        availableCapabilities: ['cvo.logging'],
    });
}

export function httpFetchTransport(route = '/invoke', method = 'POST'): CvoTransportEnvelope {
    return {
        schema: CVO_TRANSPORT_SCHEMA,
        kind: 'http-fetch',
        route,
        method,
    };
}

export { inProcessTransport };
