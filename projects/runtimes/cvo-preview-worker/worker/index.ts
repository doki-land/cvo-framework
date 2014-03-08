import { CVO_PREVIEW_CONTRACT_ID, createPreviewRouteHandlers, createPreviewRouteTable, createRouteFetchService } from '@cvo/server/worker';

export interface Env {
    CVO_CONTRACT_ID?: string;
    PREVIEW_KV?: KVNamespace;
}

const contractId = CVO_PREVIEW_CONTRACT_ID;
const routeTable = createPreviewRouteTable(contractId);
const fetch = createRouteFetchService({
    routeTable,
    handlers: createPreviewRouteHandlers(contractId),
    defaultTimeoutMs: 30_000,
});

export default {
    fetch(request: Request, env: Env): Promise<Response> {
        void env.PREVIEW_KV;
        return fetch(request);
    },
};
