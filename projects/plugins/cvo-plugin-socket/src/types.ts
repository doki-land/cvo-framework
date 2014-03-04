export const CVO_SOCKET_CAPABILITY_SCHEMA = 'cvo.socket.capability.v1';

export type CvoRuntimeHost = 'workers' | 'node' | 'browser' | 'test';

export type CvoSocketTransportKind = 'workers-do' | 'node-ws' | 'memory';

export interface CvoSocketCapabilityManifest {
    readonly schema: typeof CVO_SOCKET_CAPABILITY_SCHEMA;
    readonly transport: CvoSocketTransportKind;
    readonly durableObjectBinding?: string;
    readonly pathPrefix?: string;
    readonly maxPayloadBytes?: number;
}

export interface CvoSocketCapabilityDecision {
    readonly ok: boolean;
    readonly code: string;
    readonly messageKey: string;
    readonly manifest?: CvoSocketCapabilityManifest;
}

export interface DefineSocketPluginOptions {
    readonly name?: string;
    readonly version?: string;
    readonly manifest: CvoSocketCapabilityManifest;
}
