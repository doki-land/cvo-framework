import type { CvoTraceContext } from '@cvo/core';

export const CVO_LOG_EVENT_SCHEMA = 'cvo.obs.log_event.v1';
export const CVO_LOGGER_CONFIG_SCHEMA = 'cvo.obs.logger_config.v1';

export type CvoLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface CvoLogEvent {
    readonly schema: typeof CVO_LOG_EVENT_SCHEMA;
    readonly level: CvoLogLevel;
    readonly message: string;
    readonly timestamp: string;
    readonly trace: CvoTraceContext;
    readonly fields?: Readonly<Record<string, unknown>>;
    readonly audit?: boolean;
}

export interface CvoLoggerConfig {
    readonly schema: typeof CVO_LOGGER_CONFIG_SCHEMA;
    readonly minLevel: CvoLogLevel;
    readonly includeTimestamp: boolean;
    readonly redactKeys?: readonly string[];
}

export interface CvoLogger {
    debug(message: string, fields?: Readonly<Record<string, unknown>>): void;
    info(message: string, fields?: Readonly<Record<string, unknown>>): void;
    warn(message: string, fields?: Readonly<Record<string, unknown>>): void;
    error(message: string, fields?: Readonly<Record<string, unknown>>): void;
    audit(message: string, fields?: Readonly<Record<string, unknown>>): void;
    child(fields: Readonly<Record<string, unknown>>): CvoLogger;
}

export interface DefineLoggerPluginOptions {
    readonly name?: string;
    readonly version?: string;
    readonly config: CvoLoggerConfig;
}

export interface CreateLoggerOptions {
    readonly trace: CvoTraceContext;
    readonly config?: CvoLoggerConfig;
    readonly sink?: (event: CvoLogEvent) => void;
    readonly baseFields?: Readonly<Record<string, unknown>>;
}
