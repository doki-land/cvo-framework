export const CVO_SSE_CAPABILITY_SCHEMA = 'cvo.sse.capability.v1';

export type CvoRuntimeHost = 'workers' | 'node' | 'browser' | 'test';

export interface CvoSseCapabilityManifest {
    readonly schema: typeof CVO_SSE_CAPABILITY_SCHEMA;
    readonly pathPrefix: string;
    readonly heartbeatIntervalMs?: number;
    readonly retryMs?: number;
    readonly eventSchemaId?: string;
}

export interface CvoSseCapabilityDecision {
    readonly ok: boolean;
    readonly code: string;
    readonly messageKey: string;
    readonly manifest?: CvoSseCapabilityManifest;
}

export interface DefineSsePluginOptions {
    readonly name?: string;
    readonly version?: string;
    readonly manifest: CvoSseCapabilityManifest;
}
