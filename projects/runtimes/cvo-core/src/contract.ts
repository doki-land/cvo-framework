/** CVO versioned contract schemas (cvo-contract-v1). */

export const CVO_CONTRACT_PROTOCOL = 'cvo.contract.v1';

export const CVO_INVOCATION_SCHEMA = 'cvo.invocation.v1';
export const CVO_RESULT_SCHEMA = 'cvo.result.v1';
export const CVO_DIAGNOSTIC_SCHEMA = 'cvo.diagnostic.v1';
export const CVO_CAPABILITY_SCHEMA = 'cvo.capability.v1';
export const CVO_TRANSPORT_SCHEMA = 'cvo.transport.v1';
export const CVO_CAPABILITY_MANIFEST_SCHEMA = 'cvo.capability_manifest.v1';
export const CVO_TRACE_CONTEXT_SCHEMA = 'cvo.trace_context.v1';

export const CVO_DIAG_INVOCATION_INVALID = 'cvo::contract::invocation_invalid';
export const CVO_DIAG_CAPABILITY_MISSING = 'cvo::contract::capability_missing';
export const CVO_DIAG_TRANSPORT_UNSUPPORTED = 'cvo::contract::transport_unsupported';
export const CVO_DIAG_DEADLINE_EXCEEDED = 'cvo::contract::deadline_exceeded';

/** Stable transport kinds; delivery semantics differ, operation contract does not. */
export const CVO_TRANSPORT_KINDS = ['http-fetch', 'typed-rpc', 'queue-event', 'cron-alarm', 'in-process'] as const;

export type CvoTransportKind = (typeof CVO_TRANSPORT_KINDS)[number];

export interface CvoTraceContext {
    readonly schema: typeof CVO_TRACE_CONTEXT_SCHEMA;
    readonly requestId: string;
    readonly traceId?: string;
    readonly spanId?: string;
}

export interface CvoCapabilityRequirement {
    readonly schema: typeof CVO_CAPABILITY_SCHEMA;
    readonly id: string;
    readonly optional?: boolean;
}

export interface CvoCapabilityManifest {
    readonly schema: typeof CVO_CAPABILITY_MANIFEST_SCHEMA;
    readonly requirements: readonly CvoCapabilityRequirement[];
}

export interface CvoTransportEnvelope {
    readonly schema: typeof CVO_TRANSPORT_SCHEMA;
    readonly kind: CvoTransportKind;
    readonly route?: string;
    readonly method?: string;
}

/** Unified invocation envelope (decode -> auth -> invoke -> encode). */
export interface CvoInvocation<TInput = unknown> {
    readonly schema: typeof CVO_INVOCATION_SCHEMA;
    readonly contractId: string;
    readonly operationId: string;
    readonly transport: CvoTransportEnvelope;
    readonly input: TInput;
    readonly identity?: unknown;
    readonly capabilities: CvoCapabilityManifest;
    readonly deadline?: string;
    readonly traceContext: CvoTraceContext;
}

export type CvoDiagnosticSeverity = 'error' | 'warning' | 'info';

export interface CvoDiagnostic {
    readonly schema: typeof CVO_DIAGNOSTIC_SCHEMA;
    readonly code: string;
    readonly messageKey: string;
    readonly severity: CvoDiagnosticSeverity;
    readonly args?: Readonly<Record<string, unknown>>;
    readonly path?: readonly string[];
    readonly span?: { start: number; end: number };
    readonly requestId?: string;
    readonly cause?: CvoDiagnostic;
}

export interface CvoResult<TBody = unknown> {
    readonly schema: typeof CVO_RESULT_SCHEMA;
    readonly status: number;
    readonly body?: TBody;
    readonly diagnostic?: CvoDiagnostic;
    readonly headers?: Readonly<Record<string, string>>;
}

export interface CvoContractDocument {
    readonly kind: string;
    readonly schema: string;
}

export interface CvoContractCatalog {
    readonly schema: typeof CVO_CONTRACT_PROTOCOL;
    readonly protocol: typeof CVO_CONTRACT_PROTOCOL;
    readonly documents: readonly CvoContractDocument[];
    readonly transportKinds: readonly CvoTransportKind[];
    readonly diagnostics: readonly string[];
}

/** Returns the canonical cvo-contract-v1 catalog for conformance hosts. */
export function contractCatalog(): CvoContractCatalog {
    return {
        schema: CVO_CONTRACT_PROTOCOL,
        protocol: CVO_CONTRACT_PROTOCOL,
        documents: [
            { kind: 'invocation', schema: CVO_INVOCATION_SCHEMA },
            { kind: 'result', schema: CVO_RESULT_SCHEMA },
            { kind: 'diagnostic', schema: CVO_DIAGNOSTIC_SCHEMA },
            { kind: 'capability', schema: CVO_CAPABILITY_SCHEMA },
            { kind: 'capability_manifest', schema: CVO_CAPABILITY_MANIFEST_SCHEMA },
            { kind: 'transport', schema: CVO_TRANSPORT_SCHEMA },
            { kind: 'trace_context', schema: CVO_TRACE_CONTEXT_SCHEMA },
        ],
        transportKinds: CVO_TRANSPORT_KINDS,
        diagnostics: [CVO_DIAG_INVOCATION_INVALID, CVO_DIAG_CAPABILITY_MISSING, CVO_DIAG_TRANSPORT_UNSUPPORTED, CVO_DIAG_DEADLINE_EXCEEDED],
    };
}

/** Validates required invocation fields without executing the operation graph. */
export function validateInvocationShape(value: unknown): { ok: true; invocation: CvoInvocation } | { ok: false; diagnostic: CvoDiagnostic } {
    if (typeof value !== 'object' || value === null) {
        return {
            ok: false,
            diagnostic: {
                schema: CVO_DIAGNOSTIC_SCHEMA,
                code: CVO_DIAG_INVOCATION_INVALID,
                messageKey: 'cvo.contract.invocation_not_object',
                severity: 'error',
            },
        };
    }

    const record = value as Record<string, unknown>;
    const required = ['schema', 'contractId', 'operationId', 'transport', 'input', 'capabilities', 'traceContext'] as const;
    for (const key of required) {
        if (!(key in record)) {
            return {
                ok: false,
                diagnostic: {
                    schema: CVO_DIAGNOSTIC_SCHEMA,
                    code: CVO_DIAG_INVOCATION_INVALID,
                    messageKey: 'cvo.contract.invocation_missing_field',
                    severity: 'error',
                    args: { field: key },
                },
            };
        }
    }

    if (record.schema !== CVO_INVOCATION_SCHEMA) {
        return {
            ok: false,
            diagnostic: {
                schema: CVO_DIAGNOSTIC_SCHEMA,
                code: CVO_DIAG_INVOCATION_INVALID,
                messageKey: 'cvo.contract.invocation_schema_mismatch',
                severity: 'error',
                args: { expected: CVO_INVOCATION_SCHEMA, actual: record.schema },
            },
        };
    }

    return { ok: true, invocation: value as CvoInvocation };
}
