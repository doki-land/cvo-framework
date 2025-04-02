export const CVO_PRISMA_CAPABILITY_SCHEMA = 'cvo.prisma.capability.v1';

export type CvoRuntimeHost = 'workers' | 'node' | 'browser' | 'test';

/**
 * Prisma execution surface — not interchangeable with Iris generated calls.
 * - `node-native`: legacy Rust query engine in Node/Bun process (forbidden on Workers)
 * - `edge-wasm`: Prisma Client edge / WASM engine (6.16+); remote SQL over HTTP — **not** D1
 * - `accelerate-http`: Prisma Accelerate / connection pool over HTTPS (Workers-safe)
 * - `driver-adapter-d1`: `@prisma/adapter-d1` — **SQLite via D1 binding** (not PostgreSQL)
 */
export type CvoPrismaTransportKind = 'node-native' | 'edge-wasm' | 'accelerate-http' | 'driver-adapter-d1';

export interface CvoPrismaAccelerateConfig {
    readonly url: string;
    readonly apiKeyBinding?: string;
}

export interface CvoPrismaCapabilityManifest {
    readonly schema: typeof CVO_PRISMA_CAPABILITY_SCHEMA;
    readonly transport: CvoPrismaTransportKind;
    readonly datasourceUrlBinding?: string;
    readonly accelerate?: CvoPrismaAccelerateConfig;
    readonly d1BindingName?: string;
    /** Explicit opt-in when mixing Prisma with Iris on the same app. */
    readonly secondaryToIris?: boolean;
}

export interface CvoPrismaCapabilityDecision {
    readonly ok: boolean;
    readonly code: string;
    readonly messageKey: string;
    readonly manifest?: CvoPrismaCapabilityManifest;
}

export interface DefinePrismaPluginOptions {
    readonly name?: string;
    readonly version?: string;
    readonly manifest: CvoPrismaCapabilityManifest;
}
