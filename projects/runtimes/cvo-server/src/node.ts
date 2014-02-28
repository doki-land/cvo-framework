import { createFetchHandler } from './fetch.js';
import type { CvoServerHost } from './host.js';

export interface NodeFetchHandlerOptions {
    readonly host: CvoServerHost;
    readonly availableCapabilities?: readonly string[];
    readonly route?: string;
}

/** Fetch handler for Node 20+ / Bun / Deno — thin wrapper over createFetchHandler. */
export function createNodeFetchHandler(options: NodeFetchHandlerOptions): (request: Request) => Promise<Response> {
    return createFetchHandler({
        host: {
            contractId: options.host.contractId,
            availableCapabilities: options.availableCapabilities ?? [],
            dispatch: (invocation) => options.host.dispatch(invocation),
        },
        route: options.route,
    });
}
