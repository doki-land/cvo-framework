import { CVO_DIAGNOSTIC_SCHEMA, type CvoDiagnostic } from '@cvo/core';
import { type CvoContributionBatch, type CvoPlugin, type CvoPluginContext, definePlugin } from '@cvo/plugin';
import type {
    CvoRuntimeHost,
    CvoStorageCapabilityDecision,
    CvoStorageCapabilityManifest,
    CvoStorageDriverKind,
    DefineStoragePluginOptions,
} from './types.js';
import { CVO_STORAGE_CAPABILITY_SCHEMA } from './types.js';

export {
    CVO_STORAGE_CAPABILITY_SCHEMA,
    type CvoRuntimeHost,
    type CvoStorageCapabilityDecision,
    type CvoStorageCapabilityManifest,
    type CvoStorageDriverKind,
    type DefineStoragePluginOptions,
} from './types.js';

const WORKERS_ALLOWED: readonly CvoStorageDriverKind[] = ['r2-binding', 'kv-binding', 'memory'];
const WORKERS_FORBIDDEN: readonly CvoStorageDriverKind[] = ['filesystem'];

/** Build an object storage capability manifest. */
export function createStorageCapabilityManifest(
    driver: CvoStorageDriverKind,
    options?: { bindingName?: string; basePath?: string; publicUrlPrefix?: string },
): CvoStorageCapabilityManifest {
    return {
        schema: CVO_STORAGE_CAPABILITY_SCHEMA,
        driver,
        bindingName: options?.bindingName,
        basePath: options?.basePath,
        publicUrlPrefix: options?.publicUrlPrefix,
    };
}

/** Validate storage profile for host — fail closed on Workers + filesystem. */
export function validateStorageCapability(host: CvoRuntimeHost, manifest: CvoStorageCapabilityManifest): CvoStorageCapabilityDecision {
    if (manifest.schema !== CVO_STORAGE_CAPABILITY_SCHEMA) {
        return {
            ok: false,
            code: 'cvo::storage::capability_schema_invalid',
            messageKey: 'cvo.storage.capability_schema_invalid',
        };
    }

    if (host === 'workers' && WORKERS_FORBIDDEN.includes(manifest.driver)) {
        return {
            ok: false,
            code: 'cvo::storage::filesystem_forbidden_on_workers',
            messageKey: 'cvo.storage.filesystem_forbidden_on_workers',
        };
    }

    if (host === 'workers' && WORKERS_ALLOWED.includes(manifest.driver) && manifest.driver !== 'memory' && !manifest.bindingName) {
        return {
            ok: false,
            code: 'cvo::storage::binding_required',
            messageKey: 'cvo.storage.binding_required',
        };
    }

    if (manifest.driver === 'filesystem' && !manifest.basePath) {
        return {
            ok: false,
            code: 'cvo::storage::base_path_required',
            messageKey: 'cvo.storage.base_path_required',
        };
    }

    return {
        ok: true,
        code: 'cvo::storage::capability_ok',
        messageKey: 'cvo.storage.capability_ok',
        manifest,
    };
}

export function storageCapabilityDiagnostic(decision: CvoStorageCapabilityDecision, requestId?: string): CvoDiagnostic {
    return {
        schema: CVO_DIAGNOSTIC_SCHEMA,
        code: decision.code,
        messageKey: decision.messageKey,
        severity: decision.ok ? 'info' : 'error',
        requestId,
    };
}

function storageContributions(manifest: CvoStorageCapabilityManifest): CvoContributionBatch {
    return {
        stage: 'data_transport',
        cacheKey: `storage:${manifest.driver}`,
        deterministic: true,
        items: [
            {
                id: 'cvo.storage.capability',
                kind: 'storage_capability',
                content: JSON.stringify(manifest),
            },
        ],
    };
}

/** Register object storage capability manifest — does not bundle S3/R2 SDKs. */
export function defineStoragePlugin(options: DefineStoragePluginOptions): CvoPlugin {
    return definePlugin({
        name: options.name ?? '@cvo/plugin-storage',
        version: options.version ?? '0.0.0',
        stages: ['data_transport'],
        contribute(_ctx: CvoPluginContext) {
            return storageContributions(options.manifest);
        },
    });
}

export function storageWorkersGuidance(): string {
    return [
        'Node filesystem storage cannot run inside Cloudflare Workers.',
        'Use r2-binding (R2 bucket), kv-binding (Workers KV), or memory for tests.',
    ].join(' ');
}
