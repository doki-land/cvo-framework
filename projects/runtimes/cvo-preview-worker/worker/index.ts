import {
    createPreviewServerArtifact,
    createPreviewServerArtifactHandlerMap,
    createServerArtifactFetchService,
} from '@cvo/server/worker';

export interface Env {
    CVO_CONTRACT_ID?: string;
    PREVIEW_KV?: KVNamespace;
}

const artifact = createPreviewServerArtifact();
const handlers = createPreviewServerArtifactHandlerMap();

const fetch = createServerArtifactFetchService({
    artifact,
    handlers,
    hostProfile: 'test-host',
    availableCapabilities: ['cvo.logging'],
    defaultTimeoutMs: 30_000,
});

export default {
    fetch(request: Request, env: Env): Promise<Response> {
        void env.PREVIEW_KV;
        return fetch(request);
    },
};
