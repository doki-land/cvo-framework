import { CVO_DIAGNOSTIC_SCHEMA, type CvoDiagnostic } from '@cvo/core';
import { type CvoContributionBatch, type CvoPlugin, type CvoPluginContext, definePlugin } from '@cvo/plugin';
import type {
    CvoNotificationCapabilityDecision,
    CvoNotificationCapabilityManifest,
    CvoNotificationChannel,
    CvoRuntimeHost,
    DefineNotificationPluginOptions,
} from './types.js';
import { CVO_NOTIFICATION_CAPABILITY_SCHEMA } from './types.js';

export {
    CVO_NOTIFICATION_CAPABILITY_SCHEMA,
    type CvoNotificationCapabilityDecision,
    type CvoNotificationCapabilityManifest,
    type CvoNotificationChannel,
    type CvoRuntimeHost,
    type DefineNotificationPluginOptions,
} from './types.js';

const BINDING_REQUIRED: readonly CvoNotificationChannel[] = ['email', 'push', 'sms', 'webhook'];

/** Build a notification capability manifest. */
export function createNotificationCapabilityManifest(
    channel: CvoNotificationChannel,
    options?: { bindingName?: string; templateId?: string; defaultLocale?: string },
): CvoNotificationCapabilityManifest {
    return {
        schema: CVO_NOTIFICATION_CAPABILITY_SCHEMA,
        channel,
        bindingName: options?.bindingName,
        templateId: options?.templateId,
        defaultLocale: options?.defaultLocale,
    };
}

/** Validate notification profile for host — binding required for external channels. */
export function validateNotificationCapability(
    host: CvoRuntimeHost,
    manifest: CvoNotificationCapabilityManifest,
): CvoNotificationCapabilityDecision {
    if (manifest.schema !== CVO_NOTIFICATION_CAPABILITY_SCHEMA) {
        return {
            ok: false,
            code: 'cvo::notification::capability_schema_invalid',
            messageKey: 'cvo.notification.capability_schema_invalid',
        };
    }

    if (BINDING_REQUIRED.includes(manifest.channel) && !manifest.bindingName) {
        return {
            ok: false,
            code: 'cvo::notification::binding_required',
            messageKey: 'cvo.notification.binding_required',
        };
    }

    if (host === 'browser' && manifest.channel !== 'in-app') {
        return {
            ok: false,
            code: 'cvo::notification::browser_channel_forbidden',
            messageKey: 'cvo.notification.browser_channel_forbidden',
        };
    }

    return {
        ok: true,
        code: 'cvo::notification::capability_ok',
        messageKey: 'cvo.notification.capability_ok',
        manifest,
    };
}

export function notificationCapabilityDiagnostic(decision: CvoNotificationCapabilityDecision, requestId?: string): CvoDiagnostic {
    return {
        schema: CVO_DIAGNOSTIC_SCHEMA,
        code: decision.code,
        messageKey: decision.messageKey,
        severity: decision.ok ? 'info' : 'error',
        requestId,
    };
}

function notificationContributions(manifest: CvoNotificationCapabilityManifest): CvoContributionBatch {
    return {
        stage: 'route_emit',
        cacheKey: `notification:${manifest.channel}`,
        deterministic: true,
        items: [
            {
                id: 'cvo.notification.capability',
                kind: 'notification_capability',
                content: JSON.stringify(manifest),
            },
        ],
    };
}

/** Register notification capability manifest — does not bundle delivery SDKs. */
export function defineNotificationPlugin(options: DefineNotificationPluginOptions): CvoPlugin {
    return definePlugin({
        name: options.name ?? '@cvo/plugin-notification',
        version: options.version ?? '0.0.0',
        stages: ['route_emit'],
        contribute(_ctx: CvoPluginContext) {
            return notificationContributions(options.manifest);
        },
    });
}
