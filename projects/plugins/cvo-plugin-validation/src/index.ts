import { CVO_DIAGNOSTIC_SCHEMA, type CvoDiagnostic } from '@cvo/core';
import { type CvoContributionBatch, type CvoPlugin, type CvoPluginContext, definePlugin } from '@cvo/plugin';
import type {
    CvoValidationMode,
    CvoValidationOperationRule,
    CvoValidationProfile,
    CvoValidationProfileDecision,
    CvoValidationStrictness,
    DefineValidationPluginOptions,
} from './types.js';
import { CVO_VALIDATION_PROFILE_SCHEMA } from './types.js';

export {
    CVO_VALIDATION_PROFILE_SCHEMA,
    type CvoValidationMode,
    type CvoValidationOperationRule,
    type CvoValidationProfile,
    type CvoValidationProfileDecision,
    type CvoValidationStrictness,
    type DefineValidationPluginOptions,
} from './types.js';

/** Build a validation profile document. */
export function createValidationProfile(
    defaultMode: CvoValidationMode = 'both',
    options?: { strictness?: CvoValidationStrictness; operations?: readonly CvoValidationOperationRule[] },
): CvoValidationProfile {
    return {
        schema: CVO_VALIDATION_PROFILE_SCHEMA,
        defaultMode,
        strictness: options?.strictness ?? 'fail-closed',
        operations: options?.operations,
    };
}

function ruleHasSchema(rule: CvoValidationOperationRule, mode: CvoValidationMode): boolean {
    const effectiveMode = rule.mode ?? mode;
    if (effectiveMode === 'request' || effectiveMode === 'both') {
        if (!rule.inputSchemaId) {
            return false;
        }
    }
    if (effectiveMode === 'response' || effectiveMode === 'both') {
        if (!rule.outputSchemaId) {
            return false;
        }
    }
    return true;
}

/** Validate validation profile — operation rules must reference schema ids when enabled. */
export function validateValidationProfile(profile: CvoValidationProfile): CvoValidationProfileDecision {
    if (profile.schema !== CVO_VALIDATION_PROFILE_SCHEMA) {
        return {
            ok: false,
            code: 'cvo::validation::profile_schema_invalid',
            messageKey: 'cvo.validation.profile_schema_invalid',
        };
    }

    for (const rule of profile.operations ?? []) {
        if (!rule.operationId) {
            return {
                ok: false,
                code: 'cvo::validation::operation_id_required',
                messageKey: 'cvo.validation.operation_id_required',
            };
        }
        if (!ruleHasSchema(rule, profile.defaultMode)) {
            return {
                ok: false,
                code: 'cvo::validation::schema_id_required',
                messageKey: 'cvo.validation.schema_id_required',
            };
        }
    }

    return {
        ok: true,
        code: 'cvo::validation::profile_ok',
        messageKey: 'cvo.validation.profile_ok',
        profile,
    };
}

export function validationProfileDiagnostic(decision: CvoValidationProfileDecision, requestId?: string): CvoDiagnostic {
    return {
        schema: CVO_DIAGNOSTIC_SCHEMA,
        code: decision.code,
        messageKey: decision.messageKey,
        severity: decision.ok ? 'info' : 'error',
        requestId,
    };
}

function validationContributions(profile: CvoValidationProfile): CvoContributionBatch {
    return {
        stage: 'contract_adapter',
        cacheKey: `validation:${profile.defaultMode}:${profile.strictness}`,
        deterministic: true,
        items: [
            {
                id: 'cvo.validation.profile',
                kind: 'validation_profile',
                content: JSON.stringify(profile),
            },
        ],
    };
}

/** Register validation profile at `contract_adapter` stage. */
export function defineValidationPlugin(options: DefineValidationPluginOptions): CvoPlugin {
    if (options.profile.schema !== CVO_VALIDATION_PROFILE_SCHEMA) {
        throw new Error(`profile.schema must be ${CVO_VALIDATION_PROFILE_SCHEMA}`);
    }
    return definePlugin({
        name: options.name ?? '@cvo/plugin-validation',
        version: options.version ?? '0.0.0',
        stages: ['contract_adapter'],
        contribute(_ctx: CvoPluginContext) {
            return validationContributions(options.profile);
        },
    });
}
