import {
    createServerArtifactFetchService,
    createServerArtifactModuleHandlers,
    loadServerArtifact,
} from '@cvo/server/worker';
import artifactJson from '../generated/server-artifact.json';
import { serverModules } from '../generated/modules.js';

const artifact = loadServerArtifact(artifactJson);
const handlers = createServerArtifactModuleHandlers(artifact, async (moduleId) => {
    const load = serverModules[moduleId as keyof typeof serverModules];
    if (!load) {
        throw new Error(`cvo.homepage_api.module_unresolved:${moduleId}`);
    }
    return load();
});

const fetchApi = createServerArtifactFetchService({
    artifact,
    handlers,
    hostProfile: 'server-host',
    httpBodyMode: 'vmz-json',
    defaultTimeoutMs: 30_000,
});

function withCors(request: Request, response: Response): Response {
    const origin = request.headers.get('origin');
    if (!origin) {
        return response;
    }
    const headers = new Headers(response.headers);
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
    headers.set('access-control-allow-headers', request.headers.get('access-control-request-headers') ?? '*');
    headers.set('vary', 'origin');
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

export default {
    async fetch(request: Request): Promise<Response> {
        if (request.method === 'OPTIONS') {
            return withCors(request, new Response(null, { status: 204 }));
        }
        return withCors(request, await fetchApi(request));
    },
};
