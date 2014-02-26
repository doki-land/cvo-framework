import {
    CVO_DIAG_CAPABILITY_MISSING,
    CVO_DIAG_DEADLINE_EXCEEDED,
    CVO_DIAG_TRANSPORT_UNSUPPORTED,
    CVO_DIAGNOSTIC_SCHEMA,
    CVO_RESULT_SCHEMA,
    CVO_TRANSPORT_KINDS,
    type CvoDiagnostic,
    type CvoInvocation,
    type CvoResult,
    type CvoTransportKind,
    validateInvocationShape,
} from './contract.js';

export const CVO_EXECUTION_STAGES = ['decode', 'validate', 'capability_check', 'invoke', 'encode'] as const;

export type CvoExecutionStage = (typeof CVO_EXECUTION_STAGES)[number];

export const CVO_DIAG_DECODE_FAILED = 'cvo::contract::decode_failed';
export const CVO_DIAG_RESULT_INVALID = 'cvo::contract::result_invalid';

export interface CvoStageRecord {
    readonly stage: CvoExecutionStage;
    readonly ok: boolean;
    readonly diagnostic?: CvoDiagnostic;
    readonly durationMs?: number;
}

export interface CvoExecutionTrace {
    readonly stages: readonly CvoStageRecord[];
    readonly invocation?: CvoInvocation;
    readonly result?: CvoResult;
}

export interface CvoExecutionOptions {
    readonly raw: unknown;
    readonly contractId?: string;
    readonly availableCapabilities?: readonly string[];
    readonly supportedTransports?: readonly CvoTransportKind[];
    readonly handler?: (invocation: CvoInvocation) => Promise<CvoResult> | CvoResult;
    readonly now?: () => number;
    readonly skipInvoke?: boolean;
}

export interface CvoExecutionOutcome {
    readonly ok: boolean;
    readonly trace: CvoExecutionTrace;
    readonly result: CvoResult;
}

function diagnostic(
    code: string,
    messageKey: string,
    severity: CvoDiagnostic['severity'] = 'error',
    args?: Readonly<Record<string, unknown>>,
    requestId?: string,
): CvoDiagnostic {
    return {
        schema: CVO_DIAGNOSTIC_SCHEMA,
        code,
        messageKey,
        severity,
        args,
        requestId,
    };
}

function failureResult(status: number, diag: CvoDiagnostic): CvoResult {
    return {
        schema: CVO_RESULT_SCHEMA,
        status,
        diagnostic: diag,
    };
}

function stageRecord(stage: CvoExecutionStage, ok: boolean, diagnostic?: CvoDiagnostic, durationMs?: number): CvoStageRecord {
    return { stage, ok, diagnostic, durationMs };
}

/** Parse raw JSON or object into an invocation candidate. */
export function decodeInvocation(raw: unknown): { ok: true; value: unknown } | { ok: false; diagnostic: CvoDiagnostic } {
    if (typeof raw === 'string') {
        try {
            return { ok: true, value: JSON.parse(raw) as unknown };
        } catch {
            return {
                ok: false,
                diagnostic: diagnostic(CVO_DIAG_DECODE_FAILED, 'cvo.contract.decode_failed'),
            };
        }
    }
    return { ok: true, value: raw };
}

/** Validate transport kind, contract id, and deadline metadata. */
export function validateInvocationRuntime(
    invocation: CvoInvocation,
    options: {
        contractId?: string;
        supportedTransports?: readonly CvoTransportKind[];
        now?: () => number;
    },
): { ok: true } | { ok: false; diagnostic: CvoDiagnostic } {
    const supported = options.supportedTransports ?? CVO_TRANSPORT_KINDS;
    if (!supported.includes(invocation.transport.kind)) {
        return {
            ok: false,
            diagnostic: diagnostic(
                CVO_DIAG_TRANSPORT_UNSUPPORTED,
                'cvo.contract.transport_unsupported',
                'error',
                { kind: invocation.transport.kind },
                invocation.traceContext.requestId,
            ),
        };
    }

    if (options.contractId && invocation.contractId !== options.contractId) {
        return {
            ok: false,
            diagnostic: diagnostic(
                'cvo::contract::contract_mismatch',
                'cvo.contract.contract_mismatch',
                'error',
                { expected: options.contractId, actual: invocation.contractId },
                invocation.traceContext.requestId,
            ),
        };
    }

    if (invocation.deadline) {
        const deadlineMs = Date.parse(invocation.deadline);
        const now = options.now?.() ?? Date.now();
        if (!Number.isNaN(deadlineMs) && now > deadlineMs) {
            return {
                ok: false,
                diagnostic: diagnostic(
                    CVO_DIAG_DEADLINE_EXCEEDED,
                    'cvo.contract.deadline_exceeded',
                    'error',
                    { deadline: invocation.deadline },
                    invocation.traceContext.requestId,
                ),
            };
        }
    }

    return { ok: true };
}

/** Fail closed when required capabilities are not available on the host. */
export function checkCapabilities(
    invocation: CvoInvocation,
    availableCapabilities: readonly string[],
): { ok: true } | { ok: false; diagnostic: CvoDiagnostic } {
    const available = new Set(availableCapabilities);
    for (const requirement of invocation.capabilities.requirements) {
        if (requirement.optional) {
            continue;
        }
        if (!available.has(requirement.id)) {
            return {
                ok: false,
                diagnostic: diagnostic(
                    CVO_DIAG_CAPABILITY_MISSING,
                    'cvo.contract.capability_missing',
                    'error',
                    { capabilityId: requirement.id },
                    invocation.traceContext.requestId,
                ),
            };
        }
    }
    return { ok: true };
}

/** Normalize and validate a handler result envelope. */
export function encodeResult(result: CvoResult): { ok: true; result: CvoResult } | { ok: false; diagnostic: CvoDiagnostic } {
    if (result.schema !== CVO_RESULT_SCHEMA) {
        return {
            ok: false,
            diagnostic: diagnostic(CVO_DIAG_RESULT_INVALID, 'cvo.contract.result_schema_mismatch', 'error', {
                expected: CVO_RESULT_SCHEMA,
                actual: result.schema,
            }),
        };
    }
    if (typeof result.status !== 'number' || !Number.isFinite(result.status)) {
        return {
            ok: false,
            diagnostic: diagnostic(CVO_DIAG_RESULT_INVALID, 'cvo.contract.result_status_invalid'),
        };
    }
    return { ok: true, result };
}

/**
 * Fixed execution graph:
 * decode -> validate -> capability_check -> invoke -> encode
 */
export async function executeInvocation(options: CvoExecutionOptions): Promise<CvoExecutionOutcome> {
    const stages: CvoStageRecord[] = [];
    const now = options.now ?? (() => Date.now());

    const decoded = decodeInvocation(options.raw);
    if (!decoded.ok) {
        stages.push(stageRecord('decode', false, decoded.diagnostic));
        const result = failureResult(400, decoded.diagnostic);
        return { ok: false, trace: { stages }, result };
    }
    stages.push(stageRecord('decode', true));

    const shaped = validateInvocationShape(decoded.value);
    if (!shaped.ok) {
        stages.push(stageRecord('validate', false, shaped.diagnostic));
        const result = failureResult(400, shaped.diagnostic);
        return { ok: false, trace: { stages }, result };
    }

    const runtime = validateInvocationRuntime(shaped.invocation, {
        contractId: options.contractId,
        supportedTransports: options.supportedTransports,
        now,
    });
    if (!runtime.ok) {
        stages.push(stageRecord('validate', false, runtime.diagnostic));
        const result = failureResult(400, runtime.diagnostic);
        return { ok: false, trace: { stages, invocation: shaped.invocation }, result };
    }
    stages.push(stageRecord('validate', true));

    const capabilities = checkCapabilities(shaped.invocation, options.availableCapabilities ?? []);
    if (!capabilities.ok) {
        stages.push(stageRecord('capability_check', false, capabilities.diagnostic));
        const result = failureResult(403, capabilities.diagnostic);
        return { ok: false, trace: { stages, invocation: shaped.invocation }, result };
    }
    stages.push(stageRecord('capability_check', true));

    if (options.skipInvoke || !options.handler) {
        const result: CvoResult = {
            schema: CVO_RESULT_SCHEMA,
            status: 204,
        };
        stages.push(stageRecord('invoke', true));
        stages.push(stageRecord('encode', true));
        return {
            ok: true,
            trace: { stages, invocation: shaped.invocation, result },
            result,
        };
    }

    const invokeStart = now();
    let handlerResult: CvoResult;
    try {
        handlerResult = await options.handler(shaped.invocation);
    } catch (error) {
        const diag = diagnostic(
            'cvo::contract::handler_threw',
            'cvo.contract.handler_threw',
            'error',
            { message: error instanceof Error ? error.message : String(error) },
            shaped.invocation.traceContext.requestId,
        );
        stages.push(stageRecord('invoke', false, diag, now() - invokeStart));
        const result = failureResult(500, diag);
        return { ok: false, trace: { stages, invocation: shaped.invocation, result }, result };
    }
    stages.push(stageRecord('invoke', true, undefined, now() - invokeStart));

    const encoded = encodeResult(handlerResult);
    if (!encoded.ok) {
        stages.push(stageRecord('encode', false, encoded.diagnostic));
        const result = failureResult(500, encoded.diagnostic);
        return { ok: false, trace: { stages, invocation: shaped.invocation, result }, result };
    }
    stages.push(stageRecord('encode', true));

    return {
        ok: encoded.result.status < 400 && !encoded.result.diagnostic,
        trace: { stages, invocation: shaped.invocation, result: encoded.result },
        result: encoded.result,
    };
}

/** Redact internal args for public diagnostic surfaces. */
export function toPublicDiagnostic(diagnostic: CvoDiagnostic): CvoDiagnostic {
    return {
        schema: diagnostic.schema,
        code: diagnostic.code,
        messageKey: diagnostic.messageKey,
        severity: diagnostic.severity,
        requestId: diagnostic.requestId,
    };
}
