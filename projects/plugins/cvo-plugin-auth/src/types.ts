export const CVO_AUTH_POLICY_SCHEMA = 'cvo.auth.policy.v1';
export const CVO_AUTH_SUBJECT_SCHEMA = 'cvo.auth.subject.v1';

export type CvoAuthMode = 'anonymous' | 'bearer-jwt' | 'session-cookie';

export interface CvoAuthClaims {
    readonly schema: typeof CVO_AUTH_SUBJECT_SCHEMA;
    readonly subjectId: string;
    readonly tenantId?: string;
    readonly roles: readonly string[];
    readonly scopes?: readonly string[];
    readonly expiresAt?: string;
}

export interface CvoAuthRequirement {
    readonly operationId: string;
    readonly roles?: readonly string[];
    readonly scopes?: readonly string[];
    readonly allowAnonymous?: boolean;
}

export interface CvoAuthPolicy {
    readonly schema: typeof CVO_AUTH_POLICY_SCHEMA;
    readonly mode: CvoAuthMode;
    readonly issuer?: string;
    readonly audience?: readonly string[];
    readonly requirements: readonly CvoAuthRequirement[];
}

export interface CvoAuthDecision {
    readonly allowed: boolean;
    readonly code: string;
    readonly messageKey: string;
    readonly subject?: CvoAuthClaims;
}

export interface DefineAuthPluginOptions {
    readonly name?: string;
    readonly version?: string;
    readonly policy: CvoAuthPolicy;
}
