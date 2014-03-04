import { CVO_DIAGNOSTIC_SCHEMA, type CvoDiagnostic } from '@cvo/core';
import { type CvoContributionBatch, type CvoPlugin, type CvoPluginContext, definePlugin } from '@cvo/plugin';
import type { CvoRuntimeHost, CvoSseCapabilityDecision, CvoSseCapabilityManifest, DefineSsePluginOptions } from './types.js';
import { CVO_SSE_CAPABILITY_SCHEMA } from './types.js';

export {
    CVO_SSE_CAPABILITY_SCHEMA,
    type CvoRuntimeHost,
    type CvoSseCapabilityDecision,
    type CvoSseCapabilityManifest,
    type DefineSsePluginOptions,
} from './types.js';

/** Build an SSE capability manifest. */
export function createSseCapabilityManifest(
    pathPrefix: string,
    options?: { heartbeatIntervalMs?: number; retryMs?: number; eventSchemaId?: string },
): CvoSseCapabilityManifest {
    return {
        schema: CVO_SSE_CAPABILITY_SCHEMA,
        pathPrefix,
        heartbeatIntervalMs: options?.heartbeatIntervalMs,
        retryMs: options?.retryMs,
        eventSchemaId: options?.eventSchemaId,
    };
}

/** Validate SSE profile — path prefix required. */
export function validateSseCapability(_host: CvoRuntimeHost, manifest: CvoSseCapabilityManifest): CvoSseCapabilityDecision {
    if (manifest.schema !== CVO_SSE_CAPABILITY_SCHEMA) {
        return {
            ok: false,
            code: 'cvo::sse::capability_schema_invalid',
            messageKey: 'cvo.sse.capability_schema_invalid',
        };
    }

    if (!manifest.pathPrefix.startsWith('/')) {
        return {
            ok: false,
            code: 'cvo::sse::path_prefix_invalid',
            messageKey: 'cvo.sse.path_prefix_invalid',
        };
    }

    if (manifest.heartbeatIntervalMs !== undefined && manifest.heartbeatIntervalMs < 1000) {
        return {
            ok: false,
            code: 'cvo::sse::heartbeat_too_fast',
            messageKey: 'cvo.sse.heartbeat_too_fast',
        };
    }

    return {
        ok: true,
        code: 'cvo::sse::capability_ok',
        messageKey: 'cvo.sse.capability_ok',
        manifest,
    };
}

export function sseCapabilityDiagnostic(decision: CvoSseCapabilityDecision, requestId?: string): CvoDiagnostic {
    return {
        schema: CVO_DIAGNOSTIC_SCHEMA,
        code: decision.code,
        messageKey: decision.messageKey,
        severity: decision.ok ? 'info' : 'error',
        requestId,
    };
}

function sseContributions(manifest: CvoSseCapabilityManifest): CvoContributionBatch {
    return {
        stage: 'route_emit',
        cacheKey: `sse:${manifest.pathPrefix}`,
        deterministic: true,
        items: [
            {
                id: 'cvo.sse.capability',
                kind: 'sse_capability',
                content: JSON.stringify(manifest),
            },
        ],
    };
}

/** Register SSE capability manifest. */
export function defineSsePlugin(options: DefineSsePluginOptions): CvoPlugin {
    return definePlugin({
        name: options.name ?? '@cvo/plugin-sse',
        version: options.version ?? '0.0.0',
        stages: ['route_emit'],
        contribute(_ctx: CvoPluginContext) {
            return sseContributions(options.manifest);
        },
    });
}
