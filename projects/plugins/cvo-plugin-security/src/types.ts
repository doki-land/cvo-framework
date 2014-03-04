export const CVO_SECURITY_POLICY_SCHEMA = 'cvo.security.policy.v1';

export interface CvoCorsPolicy {
    readonly allowOrigins: readonly string[];
    readonly allowMethods?: readonly string[];
    readonly allowHeaders?: readonly string[];
    readonly exposeHeaders?: readonly string[];
    readonly maxAgeSeconds?: number;
    readonly credentials?: boolean;
}

export interface CvoRateLimitPolicy {
    readonly requestsPerMinute: number;
    readonly burst?: number;
    readonly keyBy?: 'ip' | 'subject' | 'api-key';
}

export interface CvoSecurityPolicy {
    readonly schema: typeof CVO_SECURITY_POLICY_SCHEMA;
    readonly cors?: CvoCorsPolicy;
    readonly contentSecurityPolicy?: string;
    readonly strictTransportSecurity?: string;
    readonly rateLimit?: CvoRateLimitPolicy;
    readonly additionalHeaders?: Readonly<Record<string, string>>;
}

export interface CvoSecurityPolicyDecision {
    readonly ok: boolean;
    readonly code: string;
    readonly messageKey: string;
    readonly policy?: CvoSecurityPolicy;
}

export interface DefineSecurityPluginOptions {
    readonly name?: string;
    readonly version?: string;
    readonly policy: CvoSecurityPolicy;
}
