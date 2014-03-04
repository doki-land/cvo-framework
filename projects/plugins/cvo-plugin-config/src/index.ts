import { CVO_DIAGNOSTIC_SCHEMA, type CvoDiagnostic } from '@cvo/core';
import { type CvoContributionBatch, type CvoPlugin, type CvoPluginContext, definePlugin } from '@cvo/plugin';
import type { CvoConfigProfile, CvoConfigProfileDecision, CvoConfigSource, CvoRuntimeHost, DefineConfigPluginOptions } from './types.js';
import { CVO_CONFIG_PROFILE_SCHEMA } from './types.js';

export {
    CVO_CONFIG_PROFILE_SCHEMA,
    type CvoConfigProfile,
    type CvoConfigProfileDecision,
    type CvoConfigSource,
    type CvoConfigSourceKind,
    type CvoRuntimeHost,
    type DefineConfigPluginOptions,
} from './types.js';

/** Build a configuration profile document. */
export function createConfigProfile(sources: readonly CvoConfigSource[], options?: { failOnMissingRequired?: boolean }): CvoConfigProfile {
    return {
        schema: CVO_CONFIG_PROFILE_SCHEMA,
        sources,
        failOnMissingRequired: options?.failOnMissingRequired ?? true,
    };
}

function sourceIsValid(host: CvoRuntimeHost, source: CvoConfigSource): boolean {
    if (source.kind === 'binding' && !source.bindingName) {
        return false;
    }
    if (source.kind === 'file' && !source.filePath) {
        return false;
    }
    if (host === 'workers' && source.kind === 'file') {
        return false;
    }
    return true;
}

/** Validate config profile for host — Workers cannot read arbitrary files. */
export function validateConfigProfile(host: CvoRuntimeHost, profile: CvoConfigProfile): CvoConfigProfileDecision {
    if (profile.schema !== CVO_CONFIG_PROFILE_SCHEMA) {
        return {
            ok: false,
            code: 'cvo::config::profile_schema_invalid',
            messageKey: 'cvo.config.profile_schema_invalid',
        };
    }

    if (profile.sources.length === 0) {
        return {
            ok: false,
            code: 'cvo::config::sources_required',
            messageKey: 'cvo.config.sources_required',
        };
    }

    for (const source of profile.sources) {
        if (!sourceIsValid(host, source)) {
            return {
                ok: false,
                code: 'cvo::config::source_invalid',
                messageKey: 'cvo.config.source_invalid',
            };
        }
    }

    return {
        ok: true,
        code: 'cvo::config::profile_ok',
        messageKey: 'cvo.config.profile_ok',
        profile,
    };
}

export function configProfileDiagnostic(decision: CvoConfigProfileDecision, requestId?: string): CvoDiagnostic {
    return {
        schema: CVO_DIAGNOSTIC_SCHEMA,
        code: decision.code,
        messageKey: decision.messageKey,
        severity: decision.ok ? 'info' : 'error',
        requestId,
    };
}

function configContributions(profile: CvoConfigProfile): CvoContributionBatch {
    return {
        stage: 'workspace_resolve',
        cacheKey: `config:${profile.sources.length}`,
        deterministic: true,
        items: [
            {
                id: 'cvo.config.profile',
                kind: 'config_profile',
                content: JSON.stringify(profile),
            },
        ],
    };
}

/** Register configuration profile at `workspace_resolve` stage. */
export function defineConfigPlugin(options: DefineConfigPluginOptions): CvoPlugin {
    if (options.profile.schema !== CVO_CONFIG_PROFILE_SCHEMA) {
        throw new Error(`profile.schema must be ${CVO_CONFIG_PROFILE_SCHEMA}`);
    }
    return definePlugin({
        name: options.name ?? '@cvo/plugin-config',
        version: options.version ?? '0.0.0',
        stages: ['workspace_resolve'],
        contribute(_ctx: CvoPluginContext) {
            return configContributions(options.profile);
        },
    });
}
