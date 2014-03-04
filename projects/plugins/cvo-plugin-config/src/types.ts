export const CVO_CONFIG_PROFILE_SCHEMA = 'cvo.config.profile.v1';

export type CvoRuntimeHost = 'workers' | 'node' | 'browser' | 'test';

export type CvoConfigSourceKind = 'env' | 'binding' | 'file';

export interface CvoConfigSource {
    readonly kind: CvoConfigSourceKind;
    readonly prefix?: string;
    readonly bindingName?: string;
    readonly filePath?: string;
    readonly required?: boolean;
}

export interface CvoConfigProfile {
    readonly schema: typeof CVO_CONFIG_PROFILE_SCHEMA;
    readonly sources: readonly CvoConfigSource[];
    readonly failOnMissingRequired?: boolean;
}

export interface CvoConfigProfileDecision {
    readonly ok: boolean;
    readonly code: string;
    readonly messageKey: string;
    readonly profile?: CvoConfigProfile;
}

export interface DefineConfigPluginOptions {
    readonly name?: string;
    readonly version?: string;
    readonly profile: CvoConfigProfile;
}
