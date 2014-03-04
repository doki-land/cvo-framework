export const CVO_TASK_CAPABILITY_SCHEMA = 'cvo.task.capability.v1';

export type CvoRuntimeHost = 'workers' | 'node' | 'browser' | 'test';

export type CvoTaskDriverKind = 'queue-binding' | 'cron' | 'inline';

export interface CvoTaskCapabilityManifest {
    readonly schema: typeof CVO_TASK_CAPABILITY_SCHEMA;
    readonly driver: CvoTaskDriverKind;
    readonly queueBindingName?: string;
    readonly cronExpression?: string;
    readonly deadLetterBindingName?: string;
}

export interface CvoTaskCapabilityDecision {
    readonly ok: boolean;
    readonly code: string;
    readonly messageKey: string;
    readonly manifest?: CvoTaskCapabilityManifest;
}

export interface DefineTaskPluginOptions {
    readonly name?: string;
    readonly version?: string;
    readonly manifest: CvoTaskCapabilityManifest;
}
