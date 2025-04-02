export const CVO_DRIZZLE_CAPABILITY_SCHEMA = 'cvo.drizzle.capability.v1';

export type CvoRuntimeHost = 'workers' | 'node' | 'browser' | 'test';

/**
 * Drizzle driver surface — pure TypeScript ORM; transport still depends on SQL backend.
 * - `d1-binding`: `drizzle-orm/d1` + Cloudflare D1 binding (**SQLite**, not PostgreSQL)
 * - `http-remote`: HTTP-based drivers (Neon serverless, PlanetScale serverless, libsql HTTP, etc.)
 * - `node-native`: TCP/file drivers on Node (postgres.js TCP, better-sqlite3, mysql2) — forbidden on Workers
 */
export type CvoDrizzleDriverKind = 'd1-binding' | 'http-remote' | 'node-native';

/** Known HTTP-remote Drizzle backends (informational; not enforced at runtime). */
export type CvoDrizzleHttpBackend = 'neon-http' | 'planetscale' | 'libsql-http' | 'turso' | 'other';

export interface CvoDrizzleHttpRemoteConfig {
    readonly backend?: CvoDrizzleHttpBackend;
    readonly urlBinding?: string;
    readonly url?: string;
}

export interface CvoDrizzleCapabilityManifest {
    readonly schema: typeof CVO_DRIZZLE_CAPABILITY_SCHEMA;
    readonly driver: CvoDrizzleDriverKind;
    readonly d1BindingName?: string;
    readonly httpRemote?: CvoDrizzleHttpRemoteConfig;
    readonly datasourceUrlBinding?: string;
    /** Explicit opt-in when mixing Drizzle with Iris on the same app. */
    readonly secondaryToIris?: boolean;
}

export interface CvoDrizzleCapabilityDecision {
    readonly ok: boolean;
    readonly code: string;
    readonly messageKey: string;
    readonly manifest?: CvoDrizzleCapabilityManifest;
}

export interface DefineDrizzlePluginOptions {
    readonly name?: string;
    readonly version?: string;
    readonly manifest: CvoDrizzleCapabilityManifest;
}
