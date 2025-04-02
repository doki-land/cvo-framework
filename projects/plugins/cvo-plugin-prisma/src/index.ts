import { CVO_DIAGNOSTIC_SCHEMA, type CvoDiagnostic } from '@cvo/core';
import { type CvoContributionBatch, type CvoPlugin, type CvoPluginContext, definePlugin } from '@cvo/plugin';
import type {
    CvoPrismaAccelerateConfig,
    CvoPrismaCapabilityDecision,
    CvoPrismaCapabilityManifest,
    CvoPrismaTransportKind,
    CvoRuntimeHost,
    DefinePrismaPluginOptions,
} from './types.js';
import { CVO_PRISMA_CAPABILITY_SCHEMA } from './types.js';

export {
    CVO_PRISMA_CAPABILITY_SCHEMA,
    type CvoPrismaAccelerateConfig,
    type CvoPrismaCapabilityDecision,
    type CvoPrismaCapabilityManifest,
    type CvoPrismaTransportKind,
    type CvoRuntimeHost,
    type DefinePrismaPluginOptions,
} from './types.js';

const WORKERS_ALLOWED: readonly CvoPrismaTransportKind[] = ['edge-wasm', 'accelerate-http', 'driver-adapter-d1'];
const WORKERS_FORBIDDEN: readonly CvoPrismaTransportKind[] = ['node-native'];

/** Whether this Prisma transport can run on the given host. */
export function isPrismaTransportAllowed(host: CvoRuntimeHost, transport: CvoPrismaTransportKind): boolean {
    if (host === 'workers') {
        return WORKERS_ALLOWED.includes(transport);
    }
    return true;
}

/** Build a Prisma capability manifest. */
export function createPrismaCapabilityManifest(
    transport: CvoPrismaTransportKind,
    options?: {
        datasourceUrlBinding?: string;
        accelerate?: CvoPrismaAccelerateConfig;
        d1BindingName?: string;
        secondaryToIris?: boolean;
    },
): CvoPrismaCapabilityManifest {
    return {
        schema: CVO_PRISMA_CAPABILITY_SCHEMA,
        transport,
        datasourceUrlBinding: options?.datasourceUrlBinding,
        accelerate: options?.accelerate,
        d1BindingName: options?.d1BindingName,
        secondaryToIris: options?.secondaryToIris ?? true,
    };
}

/** Validate Prisma profile for host — fail closed on Workers + native engine. */
export function validatePrismaCapability(host: CvoRuntimeHost, manifest: CvoPrismaCapabilityManifest): CvoPrismaCapabilityDecision {
    if (manifest.schema !== CVO_PRISMA_CAPABILITY_SCHEMA) {
        return {
            ok: false,
            code: 'cvo::prisma::capability_schema_invalid',
            messageKey: 'cvo.prisma.capability_schema_invalid',
        };
    }

    if (host === 'workers' && WORKERS_FORBIDDEN.includes(manifest.transport)) {
        return {
            ok: false,
            code: 'cvo::prisma::native_engine_forbidden_on_workers',
            messageKey: 'cvo.prisma.native_engine_forbidden_on_workers',
        };
    }

    if (manifest.transport === 'accelerate-http' && !manifest.accelerate?.url) {
        return {
            ok: false,
            code: 'cvo::prisma::accelerate_url_required',
            messageKey: 'cvo.prisma.accelerate_url_required',
        };
    }

    if (manifest.transport === 'driver-adapter-d1' && !manifest.d1BindingName) {
        return {
            ok: false,
            code: 'cvo::prisma::d1_binding_required',
            messageKey: 'cvo.prisma.d1_binding_required',
        };
    }

    if (manifest.transport === 'edge-wasm' && !manifest.datasourceUrlBinding) {
        return {
            ok: false,
            code: 'cvo::prisma::edge_datasource_required',
            messageKey: 'cvo.prisma.edge_datasource_required',
        };
    }

    if (manifest.transport === 'node-native' && !manifest.datasourceUrlBinding) {
        return {
            ok: false,
            code: 'cvo::prisma::datasource_binding_required',
            messageKey: 'cvo.prisma.datasource_binding_required',
        };
    }

    return {
        ok: true,
        code: 'cvo::prisma::capability_ok',
        messageKey: 'cvo.prisma.capability_ok',
        manifest,
    };
}

export function prismaCapabilityDiagnostic(decision: CvoPrismaCapabilityDecision, requestId?: string): CvoDiagnostic {
    return {
        schema: CVO_DIAGNOSTIC_SCHEMA,
        code: decision.code,
        messageKey: decision.messageKey,
        severity: decision.ok ? 'info' : 'error',
        requestId,
    };
}

function prismaContributions(manifest: CvoPrismaCapabilityManifest): CvoContributionBatch {
    return {
        stage: 'data_transport',
        cacheKey: `prisma:${manifest.transport}`,
        deterministic: true,
        items: [
            {
                id: 'cvo.prisma.capability',
                kind: 'prisma_capability',
                content: JSON.stringify(manifest),
            },
        ],
    };
}

/** Register Prisma capability manifest — does not bundle Prisma Client. */
export function definePrismaPlugin(options: DefinePrismaPluginOptions): CvoPlugin {
    return definePlugin({
        name: options.name ?? '@cvo/plugin-prisma',
        version: options.version ?? '0.0.0',
        stages: ['data_transport'],
        contribute(_ctx: CvoPluginContext) {
            return prismaContributions(options.manifest);
        },
    });
}

/** Human-readable guidance when Workers + legacy native Prisma is requested. */
export function prismaWorkersGuidance(): string {
    return [
        'Legacy Prisma native query engine (Rust binary) cannot run inside Cloudflare Workers.',
        'Use edge-wasm (remote SQL via Client edge / WASM — not D1),',
        'accelerate-http (Prisma Accelerate to remote Postgres/MySQL),',
        'driver-adapter-d1 (@prisma/adapter-d1 + D1 binding — SQLite),',
        'or prefer @cvo/plugin-iris with worker-wasm / worker-d1 / worker-gateway profiles.',
    ].join(' ');
}
