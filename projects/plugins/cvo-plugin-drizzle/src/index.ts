import { CVO_DIAGNOSTIC_SCHEMA, type CvoDiagnostic } from '@cvo/core';
import { type CvoContributionBatch, type CvoPlugin, type CvoPluginContext, definePlugin } from '@cvo/plugin';
import type {
    CvoDrizzleCapabilityDecision,
    CvoDrizzleCapabilityManifest,
    CvoDrizzleDriverKind,
    CvoDrizzleHttpRemoteConfig,
    CvoRuntimeHost,
    DefineDrizzlePluginOptions,
} from './types.js';
import { CVO_DRIZZLE_CAPABILITY_SCHEMA } from './types.js';

export {
    CVO_DRIZZLE_CAPABILITY_SCHEMA,
    type CvoDrizzleCapabilityDecision,
    type CvoDrizzleCapabilityManifest,
    type CvoDrizzleDriverKind,
    type CvoDrizzleHttpBackend,
    type CvoDrizzleHttpRemoteConfig,
    type CvoRuntimeHost,
    type DefineDrizzlePluginOptions,
} from './types.js';

const WORKERS_ALLOWED: readonly CvoDrizzleDriverKind[] = ['d1-binding', 'http-remote'];
const WORKERS_FORBIDDEN: readonly CvoDrizzleDriverKind[] = ['node-native'];

/** Whether this Drizzle driver can run on the given host. */
export function isDrizzleDriverAllowed(host: CvoRuntimeHost, driver: CvoDrizzleDriverKind): boolean {
    if (host === 'workers') {
        return WORKERS_ALLOWED.includes(driver);
    }
    return true;
}

/** Build a Drizzle capability manifest. */
export function createDrizzleCapabilityManifest(
    driver: CvoDrizzleDriverKind,
    options?: {
        d1BindingName?: string;
        httpRemote?: CvoDrizzleHttpRemoteConfig;
        datasourceUrlBinding?: string;
        secondaryToIris?: boolean;
    },
): CvoDrizzleCapabilityManifest {
    return {
        schema: CVO_DRIZZLE_CAPABILITY_SCHEMA,
        driver,
        d1BindingName: options?.d1BindingName,
        httpRemote: options?.httpRemote,
        datasourceUrlBinding: options?.datasourceUrlBinding,
        secondaryToIris: options?.secondaryToIris ?? true,
    };
}

function hasHttpRemoteTarget(httpRemote?: CvoDrizzleHttpRemoteConfig): boolean {
    return Boolean(httpRemote?.url || httpRemote?.urlBinding);
}

/** Validate Drizzle profile for host — fail closed on Workers + TCP/file drivers. */
export function validateDrizzleCapability(host: CvoRuntimeHost, manifest: CvoDrizzleCapabilityManifest): CvoDrizzleCapabilityDecision {
    if (manifest.schema !== CVO_DRIZZLE_CAPABILITY_SCHEMA) {
        return {
            ok: false,
            code: 'cvo::drizzle::capability_schema_invalid',
            messageKey: 'cvo.drizzle.capability_schema_invalid',
        };
    }

    if (host === 'workers' && WORKERS_FORBIDDEN.includes(manifest.driver)) {
        return {
            ok: false,
            code: 'cvo::drizzle::node_driver_forbidden_on_workers',
            messageKey: 'cvo.drizzle.node_driver_forbidden_on_workers',
        };
    }

    if (manifest.driver === 'd1-binding' && !manifest.d1BindingName) {
        return {
            ok: false,
            code: 'cvo::drizzle::d1_binding_required',
            messageKey: 'cvo.drizzle.d1_binding_required',
        };
    }

    if (manifest.driver === 'http-remote' && !hasHttpRemoteTarget(manifest.httpRemote)) {
        return {
            ok: false,
            code: 'cvo::drizzle::http_remote_target_required',
            messageKey: 'cvo.drizzle.http_remote_target_required',
        };
    }

    if (manifest.driver === 'node-native' && !manifest.datasourceUrlBinding) {
        return {
            ok: false,
            code: 'cvo::drizzle::datasource_binding_required',
            messageKey: 'cvo.drizzle.datasource_binding_required',
        };
    }

    return {
        ok: true,
        code: 'cvo::drizzle::capability_ok',
        messageKey: 'cvo.drizzle.capability_ok',
        manifest,
    };
}

export function drizzleCapabilityDiagnostic(decision: CvoDrizzleCapabilityDecision, requestId?: string): CvoDiagnostic {
    return {
        schema: CVO_DIAGNOSTIC_SCHEMA,
        code: decision.code,
        messageKey: decision.messageKey,
        severity: decision.ok ? 'info' : 'error',
        requestId,
    };
}

function drizzleContributions(manifest: CvoDrizzleCapabilityManifest): CvoContributionBatch {
    return {
        stage: 'data_transport',
        cacheKey: `drizzle:${manifest.driver}`,
        deterministic: true,
        items: [
            {
                id: 'cvo.drizzle.capability',
                kind: 'drizzle_capability',
                content: JSON.stringify(manifest),
            },
        ],
    };
}

/** Register Drizzle capability manifest — does not bundle drizzle-orm. */
export function defineDrizzlePlugin(options: DefineDrizzlePluginOptions): CvoPlugin {
    return definePlugin({
        name: options.name ?? '@cvo/plugin-drizzle',
        version: options.version ?? '0.0.0',
        stages: ['data_transport'],
        contribute(_ctx: CvoPluginContext) {
            return drizzleContributions(options.manifest);
        },
    });
}

/** Human-readable guidance when Workers + Node TCP/file Drizzle is requested. */
export function drizzleWorkersGuidance(): string {
    return [
        'Drizzle TCP/file drivers (postgres.js TCP, better-sqlite3, mysql2) cannot run inside Cloudflare Workers.',
        'Use d1-binding (drizzle-orm/d1 + D1 binding — SQLite),',
        'http-remote (Neon/PlanetScale/libsql HTTP drivers),',
        'or prefer @cvo/plugin-iris with worker-d1 / worker-wasm profiles.',
    ].join(' ');
}
