import { CVO_DIAGNOSTIC_SCHEMA, type CvoDiagnostic } from '@cvo/core';
import { type CvoContributionBatch, type CvoPlugin, type CvoPluginContext, definePlugin } from '@cvo/plugin';
import type { CvoOpenApiProfile, CvoOpenApiProfileDecision, CvoOpenApiVersion, DefineOpenApiPluginOptions } from './types.js';
import { CVO_OPENAPI_PROFILE_SCHEMA } from './types.js';

export {
    CVO_OPENAPI_PROFILE_SCHEMA,
    type CvoOpenApiProfile,
    type CvoOpenApiProfileDecision,
    type CvoOpenApiVersion,
    type DefineOpenApiPluginOptions,
} from './types.js';

/** Build an OpenAPI emission profile. */
export function createOpenApiProfile(
    title: string,
    openApiVersion: CvoOpenApiVersion = '3.1',
    options?: { emitPath?: string; includeDiagnostics?: boolean; serverUrl?: string },
): CvoOpenApiProfile {
    return {
        schema: CVO_OPENAPI_PROFILE_SCHEMA,
        title,
        openApiVersion,
        emitPath: options?.emitPath,
        includeDiagnostics: options?.includeDiagnostics ?? false,
        serverUrl: options?.serverUrl,
    };
}

/** Validate OpenAPI profile — title required. */
export function validateOpenApiProfile(profile: CvoOpenApiProfile): CvoOpenApiProfileDecision {
    if (profile.schema !== CVO_OPENAPI_PROFILE_SCHEMA) {
        return {
            ok: false,
            code: 'cvo::openapi::profile_schema_invalid',
            messageKey: 'cvo.openapi.profile_schema_invalid',
        };
    }

    if (!profile.title.trim()) {
        return {
            ok: false,
            code: 'cvo::openapi::title_required',
            messageKey: 'cvo.openapi.title_required',
        };
    }

    return {
        ok: true,
        code: 'cvo::openapi::profile_ok',
        messageKey: 'cvo.openapi.profile_ok',
        profile,
    };
}

export function openApiProfileDiagnostic(decision: CvoOpenApiProfileDecision, requestId?: string): CvoDiagnostic {
    return {
        schema: CVO_DIAGNOSTIC_SCHEMA,
        code: decision.code,
        messageKey: decision.messageKey,
        severity: decision.ok ? 'info' : 'error',
        requestId,
    };
}

function openApiContributions(profile: CvoOpenApiProfile): CvoContributionBatch {
    return {
        stage: 'contract_adapter',
        cacheKey: `openapi:${profile.openApiVersion}:${profile.title}`,
        deterministic: true,
        items: [
            {
                id: 'cvo.openapi.profile',
                kind: 'openapi_profile',
                content: JSON.stringify(profile),
            },
        ],
    };
}

/** Register OpenAPI emission profile at `contract_adapter` stage. */
export function defineOpenApiPlugin(options: DefineOpenApiPluginOptions): CvoPlugin {
    if (options.profile.schema !== CVO_OPENAPI_PROFILE_SCHEMA) {
        throw new Error(`profile.schema must be ${CVO_OPENAPI_PROFILE_SCHEMA}`);
    }
    return definePlugin({
        name: options.name ?? '@cvo/plugin-openapi',
        version: options.version ?? '0.0.0',
        stages: ['contract_adapter'],
        contribute(_ctx: CvoPluginContext) {
            return openApiContributions(options.profile);
        },
    });
}
