import { CVO_DIAGNOSTIC_SCHEMA, type CvoDiagnostic } from '@cvo/core';
import { type CvoContributionBatch, type CvoPlugin, type CvoPluginContext, definePlugin } from '@cvo/plugin';
import type { CvoCorsPolicy, CvoRateLimitPolicy, CvoSecurityPolicy, CvoSecurityPolicyDecision, DefineSecurityPluginOptions } from './types.js';
import { CVO_SECURITY_POLICY_SCHEMA } from './types.js';

export {
    CVO_SECURITY_POLICY_SCHEMA,
    type CvoCorsPolicy,
    type CvoRateLimitPolicy,
    type CvoSecurityPolicy,
    type CvoSecurityPolicyDecision,
    type DefineSecurityPluginOptions,
} from './types.js';

/** Build a security policy document. */
export function createSecurityPolicy(options?: {
    cors?: CvoCorsPolicy;
    contentSecurityPolicy?: string;
    strictTransportSecurity?: string;
    rateLimit?: CvoRateLimitPolicy;
    additionalHeaders?: Readonly<Record<string, string>>;
}): CvoSecurityPolicy {
    return {
        schema: CVO_SECURITY_POLICY_SCHEMA,
        cors: options?.cors,
        contentSecurityPolicy: options?.contentSecurityPolicy,
        strictTransportSecurity: options?.strictTransportSecurity,
        rateLimit: options?.rateLimit,
        additionalHeaders: options?.additionalHeaders,
    };
}

/** Validate security policy — rate limit must be positive when set. */
export function validateSecurityPolicy(policy: CvoSecurityPolicy): CvoSecurityPolicyDecision {
    if (policy.schema !== CVO_SECURITY_POLICY_SCHEMA) {
        return {
            ok: false,
            code: 'cvo::security::policy_schema_invalid',
            messageKey: 'cvo.security.policy_schema_invalid',
        };
    }

    if (policy.cors && policy.cors.allowOrigins.length === 0) {
        return {
            ok: false,
            code: 'cvo::security::cors_origins_required',
            messageKey: 'cvo.security.cors_origins_required',
        };
    }

    if (policy.rateLimit !== undefined && policy.rateLimit.requestsPerMinute <= 0) {
        return {
            ok: false,
            code: 'cvo::security::rate_limit_invalid',
            messageKey: 'cvo.security.rate_limit_invalid',
        };
    }

    return {
        ok: true,
        code: 'cvo::security::policy_ok',
        messageKey: 'cvo.security.policy_ok',
        policy,
    };
}

export function securityPolicyDiagnostic(decision: CvoSecurityPolicyDecision, requestId?: string): CvoDiagnostic {
    return {
        schema: CVO_DIAGNOSTIC_SCHEMA,
        code: decision.code,
        messageKey: decision.messageKey,
        severity: decision.ok ? 'info' : 'error',
        requestId,
    };
}

function securityContributions(policy: CvoSecurityPolicy): CvoContributionBatch {
    return {
        stage: 'auth_policy',
        cacheKey: `security:${policy.cors?.allowOrigins.length ?? 0}:${policy.rateLimit?.requestsPerMinute ?? 0}`,
        deterministic: true,
        items: [
            {
                id: 'cvo.security.policy',
                kind: 'security_policy',
                content: JSON.stringify(policy),
            },
        ],
    };
}

/** Register security policy at `auth_policy` stage (alongside auth). */
export function defineSecurityPlugin(options: DefineSecurityPluginOptions): CvoPlugin {
    if (options.policy.schema !== CVO_SECURITY_POLICY_SCHEMA) {
        throw new Error(`policy.schema must be ${CVO_SECURITY_POLICY_SCHEMA}`);
    }
    return definePlugin({
        name: options.name ?? '@cvo/plugin-security',
        version: options.version ?? '0.0.0',
        stages: ['auth_policy'],
        contribute(_ctx: CvoPluginContext) {
            return securityContributions(options.policy);
        },
    });
}
