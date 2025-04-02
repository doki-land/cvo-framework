import { CVO_DIAGNOSTIC_SCHEMA, type CvoDiagnostic } from '@cvo/core';
import { type CvoContributionBatch, type CvoPlugin, type CvoPluginContext, definePlugin } from '@cvo/plugin';
import type {
    CvoIrisDeploymentProfile,
    CvoIrisGatewayConfig,
    CvoIrisTransportDecision,
    CvoIrisTransportKind,
    CvoIrisTransportManifest,
    CvoIrisWasmTarget,
    CvoRuntimeHost,
    DefineIrisPluginOptions,
} from './types.js';
import { CVO_IRIS_TRANSPORT_SCHEMA } from './types.js';

export {
    CVO_IRIS_TRANSPORT_SCHEMA,
    type CvoIrisDbBinding,
    type CvoIrisDeploymentProfile,
    type CvoIrisGatewayConfig,
    type CvoIrisTransportDecision,
    type CvoIrisTransportKind,
    type CvoIrisTransportManifest,
    type CvoIrisWasmTarget,
    type CvoRuntimeHost,
    type DefineIrisPluginOptions,
} from './types.js';

const WORKERS_FORBIDDEN: readonly CvoIrisTransportKind[] = ['napi-in-process'];

const PROFILE_DEFAULTS: Record<CvoIrisDeploymentProfile, CvoIrisTransportKind> = {
    'worker-core': 'memory-local',
    'worker-wasm': 'wasm-local',
    'worker-d1': 'd1-binding',
    'worker-gateway': 'http-gateway',
    'worker-do': 'http-gateway',
    'node-edge': 'napi-in-process',
    'browser-local': 'wasm-local',
};

/** Map deployment profile to the default Iris transport kind. */
export function defaultTransportForProfile(profile: CvoIrisDeploymentProfile): CvoIrisTransportKind {
    return PROFILE_DEFAULTS[profile];
}

/** Build an Iris transport manifest. */
export function createIrisTransportManifest(
    deploymentProfile: CvoIrisDeploymentProfile,
    schemaFingerprint: string,
    options?: {
        transport?: CvoIrisTransportKind;
        gateway?: CvoIrisGatewayConfig;
        d1BindingName?: string;
        wasmTarget?: CvoIrisWasmTarget;
    },
): CvoIrisTransportManifest {
    const transport = options?.transport ?? defaultTransportForProfile(deploymentProfile);
    const wasmTarget =
        options?.wasmTarget ??
        (transport === 'wasm-local' || deploymentProfile === 'worker-wasm' || transport === 'd1-binding' || deploymentProfile === 'worker-d1'
            ? 'iris-unknown-wasm32'
            : undefined);
    return {
        schema: CVO_IRIS_TRANSPORT_SCHEMA,
        deploymentProfile,
        transport,
        schemaFingerprint,
        gateway: options?.gateway,
        d1BindingName: options?.d1BindingName,
        wasmTarget,
    };
}

/** Validate manifest against runtime host — Workers must never use N-API/TCP paths. */
export function validateIrisTransport(host: CvoRuntimeHost, manifest: CvoIrisTransportManifest): CvoIrisTransportDecision {
    if (manifest.schema !== CVO_IRIS_TRANSPORT_SCHEMA) {
        return {
            ok: false,
            code: 'cvo::iris::transport_schema_invalid',
            messageKey: 'cvo.iris.transport_schema_invalid',
        };
    }

    if (host === 'workers' && WORKERS_FORBIDDEN.includes(manifest.transport)) {
        return {
            ok: false,
            code: 'cvo::iris::napi_forbidden_on_workers',
            messageKey: 'cvo.iris.napi_forbidden_on_workers',
        };
    }

    if (manifest.transport === 'http-gateway' && !manifest.gateway?.url) {
        return {
            ok: false,
            code: 'cvo::iris::gateway_url_required',
            messageKey: 'cvo.iris.gateway_url_required',
        };
    }

    if (manifest.transport === 'd1-binding' && !manifest.d1BindingName) {
        return {
            ok: false,
            code: 'cvo::iris::d1_binding_required',
            messageKey: 'cvo.iris.d1_binding_required',
        };
    }

    if (host === 'workers' && manifest.transport === 'd1-binding' && manifest.wasmTarget !== 'iris-unknown-wasm32') {
        return {
            ok: false,
            code: 'cvo::iris::d1_wasm_plan_required',
            messageKey: 'cvo.iris.d1_wasm_plan_required',
        };
    }

    if (host === 'workers' && manifest.transport === 'wasm-local' && manifest.wasmTarget !== 'iris-unknown-wasm32') {
        return {
            ok: false,
            code: 'cvo::iris::wasm_target_required',
            messageKey: 'cvo.iris.wasm_target_required',
        };
    }

    if (manifest.transport === 'http-gateway' && manifest.gateway) {
        if (manifest.gateway.schemaFingerprint !== manifest.schemaFingerprint) {
            return {
                ok: false,
                code: 'cvo::iris::fingerprint_mismatch',
                messageKey: 'cvo.iris.fingerprint_mismatch',
            };
        }
    }

    return {
        ok: true,
        code: 'cvo::iris::transport_ok',
        messageKey: 'cvo.iris.transport_ok',
        manifest,
    };
}

export function irisTransportDiagnostic(decision: CvoIrisTransportDecision, requestId?: string): CvoDiagnostic {
    return {
        schema: CVO_DIAGNOSTIC_SCHEMA,
        code: decision.code,
        messageKey: decision.messageKey,
        severity: decision.ok ? 'info' : 'error',
        requestId,
    };
}

function irisContributions(manifest: CvoIrisTransportManifest): CvoContributionBatch {
    return {
        stage: 'data_transport',
        cacheKey: `iris:${manifest.deploymentProfile}:${manifest.transport}`,
        deterministic: true,
        items: [
            {
                id: 'cvo.iris.transport',
                kind: 'iris_transport',
                content: JSON.stringify(manifest),
            },
        ],
    };
}

/** Register Iris transport manifest at `data_transport` stage. */
export function defineIrisPlugin(options: DefineIrisPluginOptions): CvoPlugin {
    return definePlugin({
        name: options.name ?? '@cvo/plugin-iris',
        version: options.version ?? '0.0.0',
        stages: ['data_transport'],
        contribute(_ctx: CvoPluginContext) {
            return irisContributions(options.manifest);
        },
    });
}

/** Human-readable guidance when Workers + N-API Iris is requested. */
export function irisWorkersGuidance(): string {
    return [
        'Iris cannot run via N-API (@yydb/iris-napi) on Cloudflare Workers.',
        'Workers + D1: iris-unknown-wasm32 for Rust plan/SQL lowering, then D1 binding (env.DB) to execute.',
        'Remote DB: worker-gateway. In-memory only: worker-wasm without D1.',
    ].join(' ');
}

/** Fetch-compatible gateway call shape for Workers (no TCP). */
export async function irisGatewayFetch(manifest: CvoIrisTransportManifest, body: unknown, init?: RequestInit): Promise<Response> {
    const gateway = manifest.gateway;
    if (!gateway?.url) {
        throw new Error('http-gateway transport requires gateway.url');
    }
    const headers = new Headers(init?.headers);
    headers.set('content-type', 'application/json');
    headers.set('x-cvo-schema-fingerprint', gateway.schemaFingerprint);
    if (gateway.idempotencyHeader) {
        headers.set('idempotency-key', gateway.idempotencyHeader);
    }
    return fetch(gateway.url, {
        ...init,
        method: init?.method ?? 'POST',
        headers,
        body: JSON.stringify(body),
        signal: init?.signal ?? (gateway.deadlineMs ? AbortSignal.timeout(gateway.deadlineMs) : undefined),
    });
}
