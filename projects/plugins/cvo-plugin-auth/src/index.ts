import { CVO_DIAGNOSTIC_SCHEMA, type CvoDiagnostic } from '@cvo/core';
import { type CvoContributionBatch, type CvoPlugin, type CvoPluginContext, definePlugin } from '@cvo/plugin';
import type { CvoAuthClaims, CvoAuthDecision, CvoAuthPolicy, CvoAuthRequirement, DefineAuthPluginOptions } from './types.js';
import { CVO_AUTH_POLICY_SCHEMA, CVO_AUTH_SUBJECT_SCHEMA } from './types.js';

export {
    CVO_AUTH_POLICY_SCHEMA,
    CVO_AUTH_SUBJECT_SCHEMA,
    type CvoAuthClaims,
    type CvoAuthDecision,
    type CvoAuthMode,
    type CvoAuthPolicy,
    type CvoAuthRequirement,
    type DefineAuthPluginOptions,
} from './types.js';

/** Build a versioned auth policy document. */
export function createAuthPolicy(
    mode: CvoAuthPolicy['mode'],
    requirements: readonly CvoAuthRequirement[],
    options?: { issuer?: string; audience?: readonly string[] },
): CvoAuthPolicy {
    return {
        schema: CVO_AUTH_POLICY_SCHEMA,
        mode,
        issuer: options?.issuer,
        audience: options?.audience,
        requirements,
    };
}

/** Parse `Authorization: Bearer …` without validating signature. */
export function extractBearerToken(authorization: string | null | undefined): string | undefined {
    if (!authorization) {
        return undefined;
    }
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
    return match?.[1]?.trim() || undefined;
}

function base64UrlDecode(input: string): string {
    const padded = input
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(input.length / 4) * 4, '=');
    return atob(padded);
}

/** Decode JWT payload (no signature verification — use before crypto verify step). */
export function decodeJwtPayload(token: string): Record<string, unknown> {
    const parts = token.split('.');
    if (parts.length < 2) {
        throw new Error('invalid jwt');
    }
    const payload = base64UrlDecode(parts[1] ?? '');
    return JSON.parse(payload) as Record<string, unknown>;
}

/** Map JWT claims to CVO subject envelope. */
export function claimsFromJwtPayload(payload: Record<string, unknown>): CvoAuthClaims {
    const sub = payload.sub;
    if (typeof sub !== 'string' || !sub) {
        throw new Error('jwt missing sub');
    }
    const roles = Array.isArray(payload.roles)
        ? payload.roles.filter((r): r is string => typeof r === 'string')
        : typeof payload.role === 'string'
          ? [payload.role]
          : [];
    const scopes =
        typeof payload.scope === 'string'
            ? payload.scope.split(/\s+/).filter(Boolean)
            : Array.isArray(payload.scopes)
              ? payload.scopes.filter((s): s is string => typeof s === 'string')
              : undefined;
    const exp = payload.exp;
    return {
        schema: CVO_AUTH_SUBJECT_SCHEMA,
        subjectId: sub,
        tenantId: typeof payload.tenant === 'string' ? payload.tenant : undefined,
        roles,
        scopes,
        expiresAt: typeof exp === 'number' ? new Date(exp * 1000).toISOString() : undefined,
    };
}

function hasRequiredRoles(subject: CvoAuthClaims, required?: readonly string[]): boolean {
    if (!required || required.length === 0) {
        return true;
    }
    return required.some((role) => subject.roles.includes(role));
}

function hasRequiredScopes(subject: CvoAuthClaims, required?: readonly string[]): boolean {
    if (!required || required.length === 0) {
        return true;
    }
    const scopes = new Set(subject.scopes ?? []);
    return required.every((scope) => scopes.has(scope));
}

/** Authorize an operation against policy + subject. */
export function authorizeOperation(policy: CvoAuthPolicy, operationId: string, subject?: CvoAuthClaims): CvoAuthDecision {
    const requirement = policy.requirements.find((r) => r.operationId === operationId);
    if (!requirement) {
        return {
            allowed: true,
            code: 'cvo::auth::operation_unrestricted',
            messageKey: 'cvo.auth.operation_unrestricted',
        };
    }
    if (requirement.allowAnonymous && !subject) {
        return {
            allowed: true,
            code: 'cvo::auth::anonymous_allowed',
            messageKey: 'cvo.auth.anonymous_allowed',
        };
    }
    if (!subject) {
        return {
            allowed: false,
            code: 'cvo::auth::subject_missing',
            messageKey: 'cvo.auth.subject_missing',
        };
    }
    if (!hasRequiredRoles(subject, requirement.roles)) {
        return {
            allowed: false,
            code: 'cvo::auth::role_denied',
            messageKey: 'cvo.auth.role_denied',
            subject,
        };
    }
    if (!hasRequiredScopes(subject, requirement.scopes)) {
        return {
            allowed: false,
            code: 'cvo::auth::scope_denied',
            messageKey: 'cvo.auth.scope_denied',
            subject,
        };
    }
    return {
        allowed: true,
        code: 'cvo::auth::allowed',
        messageKey: 'cvo.auth.allowed',
        subject,
    };
}

/** Structured diagnostic for auth failures (stable code + messageKey). */
export function authDiagnostic(decision: CvoAuthDecision, requestId?: string): CvoDiagnostic {
    return {
        schema: CVO_DIAGNOSTIC_SCHEMA,
        code: decision.code,
        messageKey: decision.messageKey,
        severity: decision.allowed ? 'info' : 'error',
        requestId,
    };
}

function authContributions(policy: CvoAuthPolicy): CvoContributionBatch {
    return {
        stage: 'auth_policy',
        cacheKey: `auth:${policy.mode}:${policy.requirements.length}`,
        deterministic: true,
        items: [
            {
                id: 'cvo.auth.policy',
                kind: 'auth_policy',
                content: JSON.stringify(policy),
            },
        ],
    };
}

/** Register auth policy contributions at `auth_policy` stage. */
export function defineAuthPlugin(options: DefineAuthPluginOptions): CvoPlugin {
    if (options.policy.schema !== CVO_AUTH_POLICY_SCHEMA) {
        throw new Error(`policy.schema must be ${CVO_AUTH_POLICY_SCHEMA}`);
    }
    return definePlugin({
        name: options.name ?? '@cvo/plugin-auth',
        version: options.version ?? '0.0.0',
        stages: ['auth_policy'],
        contribute(_ctx: CvoPluginContext) {
            return authContributions(options.policy);
        },
    });
}
