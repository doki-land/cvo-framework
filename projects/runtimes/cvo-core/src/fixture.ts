import { CVO_DIAGNOSTIC_SCHEMA, type CvoInvocation, type CvoResult } from './contract.js';
import { type CvoExecutionOutcome, executeInvocation } from './execution.js';

export const CVO_FIXTURE_REPLAY_SCHEMA = 'cvo.fixture.replay.v1';
export const CVO_FIXTURE_VALIDATE_SCHEMA = 'cvo.fixture.validate.v1';

export interface CvoFixtureExpect {
    readonly status: number;
    readonly body?: unknown;
    readonly diagnosticCode?: string;
}

export interface CvoReplayFixture {
    readonly schema: typeof CVO_FIXTURE_REPLAY_SCHEMA;
    readonly name: string;
    readonly contractId: string;
    readonly availableCapabilities?: readonly string[];
    readonly invocation: CvoInvocation;
    readonly expect: CvoFixtureExpect;
}

export interface CvoValidateFixture {
    readonly schema: typeof CVO_FIXTURE_VALIDATE_SCHEMA;
    readonly name: string;
    readonly invocation: unknown;
    readonly contractId?: string;
    readonly availableCapabilities?: readonly string[];
    readonly expectValid: boolean;
    readonly expectDiagnosticCode?: string;
}

export interface CvoFixtureReplayMatch {
    readonly ok: boolean;
    readonly statusMatch: boolean;
    readonly bodyMatch: boolean;
    readonly diagnosticMatch: boolean;
    readonly diffs: readonly string[];
}

export interface CvoFixtureReplayResult {
    readonly fixture: CvoReplayFixture;
    readonly outcome: CvoExecutionOutcome;
    readonly match: CvoFixtureReplayMatch;
}

function stableJson(value: unknown): string {
    return JSON.stringify(value ?? null);
}

function bodiesEqual(expected: unknown, actual: unknown): boolean {
    return stableJson(expected) === stableJson(actual);
}

/** Validate replay fixture document shape. */
export function validateReplayFixtureShape(value: unknown): { ok: true; fixture: CvoReplayFixture } | { ok: false; message: string } {
    if (typeof value !== 'object' || value === null) {
        return { ok: false, message: 'fixture_not_object' };
    }
    const record = value as Record<string, unknown>;
    if (record.schema !== CVO_FIXTURE_REPLAY_SCHEMA) {
        return { ok: false, message: 'fixture_schema_mismatch' };
    }
    if (
        typeof record.name !== 'string' ||
        typeof record.contractId !== 'string' ||
        typeof record.expect !== 'object' ||
        record.expect === null
    ) {
        return { ok: false, message: 'fixture_missing_fields' };
    }
    return { ok: true, fixture: value as CvoReplayFixture };
}

/** Validate validate-only fixture document shape. */
export function validateValidateFixtureShape(value: unknown): { ok: true; fixture: CvoValidateFixture } | { ok: false; message: string } {
    if (typeof value !== 'object' || value === null) {
        return { ok: false, message: 'fixture_not_object' };
    }
    const record = value as Record<string, unknown>;
    if (record.schema !== CVO_FIXTURE_VALIDATE_SCHEMA) {
        return { ok: false, message: 'fixture_schema_mismatch' };
    }
    if (typeof record.name !== 'string' || typeof record.expectValid !== 'boolean' || !('invocation' in record)) {
        return { ok: false, message: 'fixture_missing_fields' };
    }
    return { ok: true, fixture: value as CvoValidateFixture };
}

/** Compare execution outcome against fixture expectations. */
export function matchFixtureExpect(result: CvoResult, expect: CvoFixtureExpect): CvoFixtureReplayMatch {
    const diffs: string[] = [];
    const statusMatch = result.status === expect.status;
    if (!statusMatch) {
        diffs.push(`status expected ${expect.status} got ${result.status}`);
    }

    const bodyMatch = expect.body === undefined ? true : bodiesEqual(expect.body, result.body);
    if (!bodyMatch) {
        diffs.push(`body mismatch expected ${stableJson(expect.body)} got ${stableJson(result.body)}`);
    }

    const actualCode = result.diagnostic?.code;
    const diagnosticMatch = expect.diagnosticCode === undefined ? actualCode === undefined : actualCode === expect.diagnosticCode;
    if (!diagnosticMatch) {
        diffs.push(`diagnostic expected ${expect.diagnosticCode ?? 'none'} got ${actualCode ?? 'none'}`);
    }

    return {
        ok: statusMatch && bodyMatch && diagnosticMatch,
        statusMatch,
        bodyMatch,
        diagnosticMatch,
        diffs,
    };
}

/** Run a replay fixture through the execution graph with a handler. */
export async function replayFixture(
    fixture: CvoReplayFixture,
    handler: (invocation: CvoInvocation) => Promise<CvoResult> | CvoResult,
    options?: { now?: () => number },
): Promise<CvoFixtureReplayResult> {
    const outcome = await executeInvocation({
        raw: fixture.invocation,
        contractId: fixture.contractId,
        availableCapabilities: fixture.availableCapabilities ?? [],
        handler,
        now: options?.now,
    });
    const match = matchFixtureExpect(outcome.result, fixture.expect);
    return { fixture, outcome, match };
}

/** Validate-only path: decode + validate + capability_check without invoke. */
export async function runValidateFixture(fixture: CvoValidateFixture): Promise<{ ok: boolean; diagnosticCode?: string }> {
    const outcome = await executeInvocation({
        raw: fixture.invocation,
        contractId: fixture.contractId,
        availableCapabilities: fixture.availableCapabilities ?? [],
        skipInvoke: true,
    });

    const failedStage = outcome.trace.stages.find((stage) => !stage.ok);
    const diagnosticCode =
        outcome.result.diagnostic?.code ?? failedStage?.diagnostic?.code ?? outcome.trace.stages.find((s) => s.diagnostic)?.diagnostic?.code;

    const passedThroughValidate = outcome.trace.stages
        .filter((stage) => stage.stage === 'decode' || stage.stage === 'validate' || stage.stage === 'capability_check')
        .every((stage) => stage.ok);

    if (fixture.expectValid) {
        return { ok: passedThroughValidate, diagnosticCode };
    }

    if (fixture.expectDiagnosticCode) {
        return { ok: diagnosticCode === fixture.expectDiagnosticCode, diagnosticCode };
    }

    return { ok: !passedThroughValidate, diagnosticCode };
}

/** Parse JSON text into unknown value. */
export function parseFixtureJson(text: string): unknown {
    return JSON.parse(text) as unknown;
}

/** Load fixture from parsed JSON — auto-detect replay vs validate schema. */
export function loadFixtureDocument(
    value: unknown,
):
    | { kind: 'replay'; fixture: CvoReplayFixture }
    | { kind: 'validate'; fixture: CvoValidateFixture }
    | { kind: 'invocation'; invocation: unknown }
    | { kind: 'error'; message: string } {
    if (typeof value !== 'object' || value === null) {
        return { kind: 'error', message: 'not_object' };
    }
    const schema = (value as Record<string, unknown>).schema;
    if (schema === CVO_FIXTURE_REPLAY_SCHEMA) {
        const checked = validateReplayFixtureShape(value);
        return checked.ok ? { kind: 'replay', fixture: checked.fixture } : { kind: 'error', message: checked.message };
    }
    if (schema === CVO_FIXTURE_VALIDATE_SCHEMA) {
        const checked = validateValidateFixtureShape(value);
        return checked.ok ? { kind: 'validate', fixture: checked.fixture } : { kind: 'error', message: checked.message };
    }
    if ((value as Record<string, unknown>).schema === 'cvo.invocation.v1') {
        return { kind: 'invocation', invocation: value };
    }
    return { kind: 'invocation', invocation: value };
}

export function formatExecutionReport(outcome: CvoExecutionOutcome): string {
    return JSON.stringify(
        {
            ok: outcome.ok,
            stages: outcome.trace.stages,
            result: {
                status: outcome.result.status,
                body: outcome.result.body,
                diagnostic: outcome.result.diagnostic
                    ? {
                          schema: CVO_DIAGNOSTIC_SCHEMA,
                          code: outcome.result.diagnostic.code,
                          messageKey: outcome.result.diagnostic.messageKey,
                          severity: outcome.result.diagnostic.severity,
                          requestId: outcome.result.diagnostic.requestId,
                      }
                    : undefined,
            },
        },
        null,
        2,
    );
}
