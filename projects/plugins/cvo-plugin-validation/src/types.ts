export const CVO_VALIDATION_PROFILE_SCHEMA = 'cvo.validation.profile.v1';

export type CvoValidationMode = 'request' | 'response' | 'both';

export type CvoValidationStrictness = 'fail-closed' | 'warn-only';

export interface CvoValidationOperationRule {
    readonly operationId: string;
    readonly mode?: CvoValidationMode;
    readonly inputSchemaId?: string;
    readonly outputSchemaId?: string;
}

export interface CvoValidationProfile {
    readonly schema: typeof CVO_VALIDATION_PROFILE_SCHEMA;
    readonly defaultMode: CvoValidationMode;
    readonly strictness: CvoValidationStrictness;
    readonly operations?: readonly CvoValidationOperationRule[];
}

export interface CvoValidationProfileDecision {
    readonly ok: boolean;
    readonly code: string;
    readonly messageKey: string;
    readonly profile?: CvoValidationProfile;
}

export interface DefineValidationPluginOptions {
    readonly name?: string;
    readonly version?: string;
    readonly profile: CvoValidationProfile;
}
