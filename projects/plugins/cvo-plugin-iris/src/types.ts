export const CVO_IRIS_TRANSPORT_SCHEMA = 'cvo.iris.transport.v1';

/** CVO deployment profile names. */
export type CvoIrisDeploymentProfile =
    | 'worker-core'
    | 'worker-wasm'
    | 'worker-d1'
    | 'worker-gateway'
    | 'worker-do'
    | 'node-edge'
    | 'browser-local';

/** Runtime host kind detected at build or deploy time. */
export type CvoRuntimeHost = 'workers' | 'node' | 'browser' | 'test';

/** How generated Iris calls reach a database executor. */
export type CvoIrisTransportKind = 'memory-local' | 'wasm-local' | 'd1-binding' | 'http-gateway' | 'napi-in-process';

/**
 * Iris WASM artifact target for edge in-process execution (no N-API, no TCP).
 * `iris-unknown-wasm32` is the packaging route for Workers / browser WASM hosts.
 */
export type CvoIrisWasmTarget = 'iris-unknown-wasm32';

export interface CvoIrisGatewayConfig {
    readonly url: string;
    readonly schemaFingerprint: string;
    readonly deadlineMs?: number;
    readonly idempotencyHeader?: string;
}

export interface CvoIrisTransportManifest {
    readonly schema: typeof CVO_IRIS_TRANSPORT_SCHEMA;
    readonly deploymentProfile: CvoIrisDeploymentProfile;
    readonly transport: CvoIrisTransportKind;
    readonly schemaFingerprint: string;
    readonly gateway?: CvoIrisGatewayConfig;
    readonly d1BindingName?: string;
    /** Required on Workers for `d1-binding` — Rust WASM plan/SQL; D1 only executes. */
    readonly wasmTarget?: CvoIrisWasmTarget;
}

export interface CvoIrisTransportDecision {
    readonly ok: boolean;
    readonly code: string;
    readonly messageKey: string;
    readonly manifest?: CvoIrisTransportManifest;
}

export interface DefineIrisPluginOptions {
    readonly name?: string;
    readonly version?: string;
    readonly manifest: CvoIrisTransportManifest;
}

/** Minimal generated-call surface injected into CVO hosts (full contract lives in Iris). */
export interface CvoIrisDbBinding {
    generatedCall(envelope: unknown): Promise<unknown>;
}
