export const CVO_NOTIFICATION_CAPABILITY_SCHEMA = 'cvo.notification.capability.v1';

export type CvoRuntimeHost = 'workers' | 'node' | 'browser' | 'test';

export type CvoNotificationChannel = 'email' | 'push' | 'sms' | 'webhook' | 'in-app';

export interface CvoNotificationCapabilityManifest {
    readonly schema: typeof CVO_NOTIFICATION_CAPABILITY_SCHEMA;
    readonly channel: CvoNotificationChannel;
    readonly bindingName?: string;
    readonly templateId?: string;
    readonly defaultLocale?: string;
}

export interface CvoNotificationCapabilityDecision {
    readonly ok: boolean;
    readonly code: string;
    readonly messageKey: string;
    readonly manifest?: CvoNotificationCapabilityManifest;
}

export interface DefineNotificationPluginOptions {
    readonly name?: string;
    readonly version?: string;
    readonly manifest: CvoNotificationCapabilityManifest;
}
