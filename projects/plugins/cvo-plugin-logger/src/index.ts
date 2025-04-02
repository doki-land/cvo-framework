import { CVO_TRACE_CONTEXT_SCHEMA, type CvoTraceContext } from '@cvo/core';
import { type CvoContributionBatch, type CvoPlugin, type CvoPluginContext, definePlugin } from '@cvo/plugin';
import type { CreateLoggerOptions, CvoLogEvent, CvoLogger, CvoLoggerConfig, CvoLogLevel, DefineLoggerPluginOptions } from './types.js';
import { CVO_LOG_EVENT_SCHEMA, CVO_LOGGER_CONFIG_SCHEMA } from './types.js';

export {
    type CreateLoggerOptions,
    CVO_LOG_EVENT_SCHEMA,
    CVO_LOGGER_CONFIG_SCHEMA,
    type CvoLogEvent,
    type CvoLogger,
    type CvoLoggerConfig,
    type CvoLogLevel,
    type DefineLoggerPluginOptions,
} from './types.js';

const LEVEL_RANK: Record<CvoLogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};

const DEFAULT_CONFIG: CvoLoggerConfig = {
    schema: CVO_LOGGER_CONFIG_SCHEMA,
    minLevel: 'info',
    includeTimestamp: true,
    redactKeys: ['password', 'token', 'authorization', 'secret'],
};

/** Default logger config for edge hosts. */
export function createLoggerConfig(options?: Partial<Omit<CvoLoggerConfig, 'schema'>>): CvoLoggerConfig {
    return {
        ...DEFAULT_CONFIG,
        ...options,
        schema: CVO_LOGGER_CONFIG_SCHEMA,
    };
}

function redactFields(
    fields: Readonly<Record<string, unknown>> | undefined,
    redactKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
    if (!fields) {
        return undefined;
    }
    const lowered = new Set(redactKeys.map((k) => k.toLowerCase()));
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
        out[key] = lowered.has(key.toLowerCase()) ? '[redacted]' : value;
    }
    return out;
}

/** Serialize a structured log event as JSON (one line). */
export function formatLogEvent(event: CvoLogEvent): string {
    return JSON.stringify(event);
}

function shouldLog(level: CvoLogLevel, minLevel: CvoLogLevel): boolean {
    return LEVEL_RANK[level] >= LEVEL_RANK[minLevel];
}

function emitEvent(
    level: CvoLogLevel,
    message: string,
    trace: CvoTraceContext,
    config: CvoLoggerConfig,
    sink: (event: CvoLogEvent) => void,
    fields?: Readonly<Record<string, unknown>>,
    audit = false,
): void {
    if (!shouldLog(level, config.minLevel) && !audit) {
        return;
    }
    const event: CvoLogEvent = {
        schema: CVO_LOG_EVENT_SCHEMA,
        level,
        message,
        timestamp: new Date().toISOString(),
        trace,
        fields: redactFields(fields, config.redactKeys ?? []),
        audit: audit || undefined,
    };
    sink(event);
}

/** Create a structured logger bound to invocation trace context. */
export function createLogger(options: CreateLoggerOptions): CvoLogger {
    const config = options.config ?? DEFAULT_CONFIG;
    const baseFields = options.baseFields ?? {};
    const sink =
        options.sink ??
        ((event) => {
            const line = formatLogEvent(event);
            if (event.level === 'error' || event.level === 'warn') {
                console.error(line);
            } else {
                console.log(line);
            }
        });

    const log =
        (level: CvoLogLevel) =>
        (message: string, fields?: Readonly<Record<string, unknown>>): void => {
            emitEvent(level, message, options.trace, config, sink, { ...baseFields, ...fields });
        };

    return {
        debug: log('debug'),
        info: log('info'),
        warn: log('warn'),
        error: log('error'),
        audit(message, fields) {
            emitEvent('info', message, options.trace, config, sink, { ...baseFields, ...fields }, true);
        },
        child(fields) {
            return createLogger({
                trace: options.trace,
                config,
                sink,
                baseFields: { ...baseFields, ...fields },
            });
        },
    };
}

/** Build trace context from request headers or generate ids. */
export function traceFromRequest(request: Request, requestId?: string): CvoTraceContext {
    const incomingRequestId = request.headers.get('x-request-id') ?? requestId ?? crypto.randomUUID();
    return {
        schema: CVO_TRACE_CONTEXT_SCHEMA,
        requestId: incomingRequestId,
        traceId: request.headers.get('traceparent')?.split('-')[1] ?? undefined,
        spanId: request.headers.get('x-span-id') ?? undefined,
    };
}

function loggerContributions(config: CvoLoggerConfig): CvoContributionBatch {
    return {
        stage: 'observability',
        cacheKey: `logger:${config.minLevel}`,
        deterministic: true,
        items: [
            {
                id: 'cvo.obs.logger_config',
                kind: 'logger_config',
                content: JSON.stringify(config),
            },
        ],
    };
}

/** Register logger config at `observability` stage. */
export function defineLoggerPlugin(options: DefineLoggerPluginOptions): CvoPlugin {
    if (options.config.schema !== CVO_LOGGER_CONFIG_SCHEMA) {
        throw new Error(`config.schema must be ${CVO_LOGGER_CONFIG_SCHEMA}`);
    }
    return definePlugin({
        name: options.name ?? '@cvo/plugin-logger',
        version: options.version ?? '0.0.0',
        stages: ['observability'],
        contribute(_ctx: CvoPluginContext) {
            return loggerContributions(options.config);
        },
    });
}
