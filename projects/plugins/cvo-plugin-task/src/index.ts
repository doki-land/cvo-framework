import { CVO_DIAGNOSTIC_SCHEMA, type CvoDiagnostic } from '@cvo/core';
import { type CvoContributionBatch, type CvoPlugin, type CvoPluginContext, definePlugin } from '@cvo/plugin';
import type {
    CvoRuntimeHost,
    CvoTaskCapabilityDecision,
    CvoTaskCapabilityManifest,
    CvoTaskDriverKind,
    DefineTaskPluginOptions,
} from './types.js';
import { CVO_TASK_CAPABILITY_SCHEMA } from './types.js';

export {
    CVO_TASK_CAPABILITY_SCHEMA,
    type CvoRuntimeHost,
    type CvoTaskCapabilityDecision,
    type CvoTaskCapabilityManifest,
    type CvoTaskDriverKind,
    type DefineTaskPluginOptions,
} from './types.js';

/** Build a background task capability manifest. */
export function createTaskCapabilityManifest(
    driver: CvoTaskDriverKind,
    options?: { queueBindingName?: string; cronExpression?: string; deadLetterBindingName?: string },
): CvoTaskCapabilityManifest {
    return {
        schema: CVO_TASK_CAPABILITY_SCHEMA,
        driver,
        queueBindingName: options?.queueBindingName,
        cronExpression: options?.cronExpression,
        deadLetterBindingName: options?.deadLetterBindingName,
    };
}

/** Validate task profile for host — queue/cron bindings required when applicable. */
export function validateTaskCapability(host: CvoRuntimeHost, manifest: CvoTaskCapabilityManifest): CvoTaskCapabilityDecision {
    if (manifest.schema !== CVO_TASK_CAPABILITY_SCHEMA) {
        return {
            ok: false,
            code: 'cvo::task::capability_schema_invalid',
            messageKey: 'cvo.task.capability_schema_invalid',
        };
    }

    if (manifest.driver === 'queue-binding' && !manifest.queueBindingName) {
        return {
            ok: false,
            code: 'cvo::task::queue_binding_required',
            messageKey: 'cvo.task.queue_binding_required',
        };
    }

    if (manifest.driver === 'cron' && !manifest.cronExpression) {
        return {
            ok: false,
            code: 'cvo::task::cron_expression_required',
            messageKey: 'cvo.task.cron_expression_required',
        };
    }

    if (host === 'browser' && manifest.driver !== 'inline') {
        return {
            ok: false,
            code: 'cvo::task::browser_driver_forbidden',
            messageKey: 'cvo.task.browser_driver_forbidden',
        };
    }

    return {
        ok: true,
        code: 'cvo::task::capability_ok',
        messageKey: 'cvo.task.capability_ok',
        manifest,
    };
}

export function taskCapabilityDiagnostic(decision: CvoTaskCapabilityDecision, requestId?: string): CvoDiagnostic {
    return {
        schema: CVO_DIAGNOSTIC_SCHEMA,
        code: decision.code,
        messageKey: decision.messageKey,
        severity: decision.ok ? 'info' : 'error',
        requestId,
    };
}

function taskContributions(manifest: CvoTaskCapabilityManifest): CvoContributionBatch {
    return {
        stage: 'worker_bundle',
        cacheKey: `task:${manifest.driver}`,
        deterministic: true,
        items: [
            {
                id: 'cvo.task.capability',
                kind: 'task_capability',
                content: JSON.stringify(manifest),
            },
        ],
    };
}

/** Register background task capability manifest — does not bundle queue SDKs. */
export function defineTaskPlugin(options: DefineTaskPluginOptions): CvoPlugin {
    return definePlugin({
        name: options.name ?? '@cvo/plugin-task',
        version: options.version ?? '0.0.0',
        stages: ['worker_bundle'],
        contribute(_ctx: CvoPluginContext) {
            return taskContributions(options.manifest);
        },
    });
}
