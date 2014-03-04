export const CVO_STORAGE_CAPABILITY_SCHEMA = 'cvo.storage.capability.v1';

export type CvoRuntimeHost = 'workers' | 'node' | 'browser' | 'test';

export type CvoStorageDriverKind = 'r2-binding' | 'kv-binding' | 'filesystem' | 'memory';

export interface CvoStorageCapabilityManifest {
    readonly schema: typeof CVO_STORAGE_CAPABILITY_SCHEMA;
    readonly driver: CvoStorageDriverKind;
    readonly bindingName?: string;
    readonly basePath?: string;
    readonly publicUrlPrefix?: string;
}

export interface CvoStorageCapabilityDecision {
    readonly ok: boolean;
    readonly code: string;
    readonly messageKey: string;
    readonly manifest?: CvoStorageCapabilityManifest;
}

export interface DefineStoragePluginOptions {
    readonly name?: string;
    readonly version?: string;
    readonly manifest: CvoStorageCapabilityManifest;
}
