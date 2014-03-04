import { CVO_DIAGNOSTIC_SCHEMA, type CvoDiagnostic } from '@cvo/core';
import { type CvoContributionBatch, type CvoPlugin, type CvoPluginContext, definePlugin } from '@cvo/plugin';
import type {
    CvoRuntimeHost,
    CvoSocketCapabilityDecision,
    CvoSocketCapabilityManifest,
    CvoSocketTransportKind,
    DefineSocketPluginOptions,
} from './types.js';
import { CVO_SOCKET_CAPABILITY_SCHEMA } from './types.js';

export {
    CVO_SOCKET_CAPABILITY_SCHEMA,
    type CvoRuntimeHost,
    type CvoSocketCapabilityDecision,
    type CvoSocketCapabilityManifest,
    type CvoSocketTransportKind,
    type DefineSocketPluginOptions,
} from './types.js';

const WORKERS_ALLOWED: readonly CvoSocketTransportKind[] = ['workers-do', 'memory'];
const WORKERS_FORBIDDEN: readonly CvoSocketTransportKind[] = ['node-ws'];

/** Build a WebSocket capability manifest. */
export function createSocketCapabilityManifest(
    transport: CvoSocketTransportKind,
    options?: { durableObjectBinding?: string; pathPrefix?: string; maxPayloadBytes?: number },
): CvoSocketCapabilityManifest {
    return {
        schema: CVO_SOCKET_CAPABILITY_SCHEMA,
        transport,
        durableObjectBinding: options?.durableObjectBinding,
        pathPrefix: options?.pathPrefix,
        maxPayloadBytes: options?.maxPayloadBytes,
    };
}

/** Validate socket profile for host — fail closed on Workers + node-ws. */
export function validateSocketCapability(host: CvoRuntimeHost, manifest: CvoSocketCapabilityManifest): CvoSocketCapabilityDecision {
    if (manifest.schema !== CVO_SOCKET_CAPABILITY_SCHEMA) {
        return {
            ok: false,
            code: 'cvo::socket::capability_schema_invalid',
            messageKey: 'cvo.socket.capability_schema_invalid',
        };
    }

    if (host === 'workers' && WORKERS_FORBIDDEN.includes(manifest.transport)) {
        return {
            ok: false,
            code: 'cvo::socket::node_ws_forbidden_on_workers',
            messageKey: 'cvo.socket.node_ws_forbidden_on_workers',
        };
    }

    if (
        host === 'workers' &&
        WORKERS_ALLOWED.includes(manifest.transport) &&
        manifest.transport === 'workers-do' &&
        !manifest.durableObjectBinding
    ) {
        return {
            ok: false,
            code: 'cvo::socket::durable_object_binding_required',
            messageKey: 'cvo.socket.durable_object_binding_required',
        };
    }

    return {
        ok: true,
        code: 'cvo::socket::capability_ok',
        messageKey: 'cvo.socket.capability_ok',
        manifest,
    };
}

export function socketCapabilityDiagnostic(decision: CvoSocketCapabilityDecision, requestId?: string): CvoDiagnostic {
    return {
        schema: CVO_DIAGNOSTIC_SCHEMA,
        code: decision.code,
        messageKey: decision.messageKey,
        severity: decision.ok ? 'info' : 'error',
        requestId,
    };
}

function socketContributions(manifest: CvoSocketCapabilityManifest): CvoContributionBatch {
    return {
        stage: 'route_emit',
        cacheKey: `socket:${manifest.transport}`,
        deterministic: true,
        items: [
            {
                id: 'cvo.socket.capability',
                kind: 'socket_capability',
                content: JSON.stringify(manifest),
            },
        ],
    };
}

/** Register WebSocket capability manifest — does not bundle ws libraries. */
export function defineSocketPlugin(options: DefineSocketPluginOptions): CvoPlugin {
    return definePlugin({
        name: options.name ?? '@cvo/plugin-socket',
        version: options.version ?? '0.0.0',
        stages: ['route_emit'],
        contribute(_ctx: CvoPluginContext) {
            return socketContributions(options.manifest);
        },
    });
}

export function socketWorkersGuidance(): string {
    return [
        'Node TCP WebSocket servers cannot run inside Cloudflare Workers.',
        'Use workers-do (Durable Objects hibernatable WebSocket API) or memory transport for tests.',
    ].join(' ');
}
