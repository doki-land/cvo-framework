export const CVO_OPENAPI_PROFILE_SCHEMA = 'cvo.openapi.profile.v1';

export type CvoOpenApiVersion = '3.0' | '3.1';

export interface CvoOpenApiProfile {
    readonly schema: typeof CVO_OPENAPI_PROFILE_SCHEMA;
    readonly openApiVersion: CvoOpenApiVersion;
    readonly title: string;
    readonly emitPath?: string;
    readonly includeDiagnostics?: boolean;
    readonly serverUrl?: string;
}

export interface CvoOpenApiProfileDecision {
    readonly ok: boolean;
    readonly code: string;
    readonly messageKey: string;
    readonly profile?: CvoOpenApiProfile;
}

export interface DefineOpenApiPluginOptions {
    readonly name?: string;
    readonly version?: string;
    readonly profile: CvoOpenApiProfile;
}
