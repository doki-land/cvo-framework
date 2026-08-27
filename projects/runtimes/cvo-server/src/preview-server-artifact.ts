import { VMZ_HTTP_CONTRACT_SCHEMA, VMZ_SERVER_ARTIFACT_SCHEMA, type VmzServerArtifact, vmzOperationId } from '@cvo/core';
import { createPreviewRouteHandlers } from './preview-routes.js';
import { CVO_PREVIEW_CONTRACT_ID } from './test-host.js';

/** Minimal VMZ ServerArtifact matching preview health + data routes (0.0.3 smoke). */
export function createPreviewServerArtifact(contractId = CVO_PREVIEW_CONTRACT_ID): VmzServerArtifact {
    return {
        schema: VMZ_SERVER_ARTIFACT_SCHEMA,
        profileId: `${contractId}.server-host`,
        assembly: 'server-host',
        selectedRuntime: 'worker',
        entry: {
            kind: 'fetch',
            standards: ['Request', 'Response', 'Streams', 'AbortSignal'],
            rpcPath: '/__vmz/rpc',
        },
        httpContract: {
            schema: VMZ_HTTP_CONTRACT_SCHEMA,
            digest: 'preview-smoke-digest',
        },
        publicRoutes: [
            {
                verb: 'GET',
                path: '/health',
                moduleId: '#server/preview/Health',
                method: 'health',
                visibility: 'public',
                kind: 'server-route',
            },
            {
                verb: 'GET',
                path: '/data/:id',
                moduleId: '#server/preview/Data',
                method: 'getData',
                visibility: 'public',
                kind: 'server-route',
                requiredCapabilities: ['cvo.logging'],
                query: [{ name: 'limit', required: false }],
            },
        ],
        internalCapabilities: [
            {
                chunkId: 'preview-internal',
                moduleId: '#server/preview/User',
                method: 'fetchUser',
                visibility: 'internal',
                kind: 'capability',
            },
        ],
        secretRequirements: [
            {
                id: 'PREVIEW_KV',
                bindingName: 'PREVIEW_KV',
                optional: true,
            },
        ],
        artifactDigest: 'preview-artifact-digest',
    };
}

/** Handler map keyed by VMZ operation ids for preview routes. */
export function createPreviewServerArtifactHandlerMap(
    contractId = CVO_PREVIEW_CONTRACT_ID,
): Readonly<Record<string, ReturnType<typeof createPreviewRouteHandlers>[string]>> {
    const handlers = createPreviewRouteHandlers(contractId);
    return {
        [vmzOperationId('#server/preview/Health', 'health')]: handlers.health!,
        [vmzOperationId('#server/preview/Data', 'getData')]: handlers.getData!,
    };
}
