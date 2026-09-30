import {
    CVO_CAPABILITY_MANIFEST_SCHEMA,
    CVO_CAPABILITY_SCHEMA,
    CVO_DIAGNOSTIC_SCHEMA,
    type CvoCapabilityManifest,
    type CvoCapabilityRequirement,
    type CvoDiagnostic,
} from './contract.js';

export const VMZ_SERVER_ARTIFACT_SCHEMA = 'vmz.server.artifact.v0';
export const VMZ_HTTP_CONTRACT_SCHEMA = 'vmz.http.contract.v0';

export interface VmzServerArtifactEntry {
    readonly kind: 'fetch';
    readonly standards?: readonly string[];
    readonly rpcPath?: string;
}

export interface VmzHttpContract {
    readonly schema: typeof VMZ_HTTP_CONTRACT_SCHEMA | string;
    readonly digest: string;
}

export interface VmzPublicRoute {
    readonly verb: string;
    readonly path: string;
    readonly moduleId: string;
    readonly method: string;
    readonly className?: string | null;
    readonly visibility?: string;
    readonly kind?: string;
    readonly requiredCapabilities?: readonly string[];
    readonly query?: readonly { readonly name: string; readonly required?: boolean }[];
}

export interface VmzInternalCapability {
    readonly chunkId?: string;
    readonly moduleId: string;
    readonly method: string;
    readonly visibility?: string;
    readonly kind?: string;
}

export interface VmzSecretRequirement {
    readonly id: string;
    readonly bindingName?: string;
    readonly optional?: boolean;
}

export interface VmzServerArtifact {
    readonly schema: typeof VMZ_SERVER_ARTIFACT_SCHEMA;
    readonly profileId?: string | null;
    readonly assembly?: string | null;
    readonly selectedRuntime?: string;
    readonly entry: VmzServerArtifactEntry;
    readonly httpContract?: VmzHttpContract;
    readonly publicRoutes: readonly VmzPublicRoute[];
    readonly internalCapabilities: readonly VmzInternalCapability[];
    readonly secretRequirements?: readonly VmzSecretRequirement[];
    readonly artifactDigest?: string;
}

export interface VmzServerArtifactDecision {
    readonly ok: boolean;
    readonly code: string;
    readonly messageKey: string;
    readonly artifact?: VmzServerArtifact;
}

export type CvoHostProfile = 'static' | 'server-host' | 'test-host';

export interface CvoHostCapabilityDiagnostic {
    readonly profile: CvoHostProfile;
    readonly ok: boolean;
    readonly code: string;
    readonly messageKey: string;
    readonly notes?: readonly string[];
}

function artifactDiagnostic(code: string, messageKey: string, args?: Readonly<Record<string, unknown>>): CvoDiagnostic {
    return {
        schema: CVO_DIAGNOSTIC_SCHEMA,
        code,
        messageKey,
        severity: 'error',
        args,
    };
}

/** Stable CVO operation id for a VMZ public route or internal capability. */
export function vmzOperationId(moduleId: string, method: string): string {
    return `${moduleId}::${method}`;
}

/** Parse operation id back into moduleId and method. */
export function parseVmzOperationId(operationId: string): { moduleId: string; method: string } | undefined {
    const idx = operationId.indexOf('::');
    if (idx <= 0) {
        return undefined;
    }
    return {
        moduleId: operationId.slice(0, idx),
        method: operationId.slice(idx + 2),
    };
}

/** Validate VMZ ServerArtifact wire shape (no secret values). */
export function validateServerArtifact(value: unknown): VmzServerArtifactDecision {
    if (typeof value !== 'object' || value === null) {
        return {
            ok: false,
            code: 'cvo::server_artifact::not_object',
            messageKey: 'cvo.server_artifact.not_object',
        };
    }

    const record = value as Record<string, unknown>;
    if (record.schema !== VMZ_SERVER_ARTIFACT_SCHEMA) {
        return {
            ok: false,
            code: 'cvo::server_artifact::schema_mismatch',
            messageKey: 'cvo.server_artifact.schema_mismatch',
        };
    }

    if (!record.entry || typeof record.entry !== 'object') {
        return {
            ok: false,
            code: 'cvo::server_artifact::entry_missing',
            messageKey: 'cvo.server_artifact.entry_missing',
        };
    }

    const entry = record.entry as Record<string, unknown>;
    if (entry.kind !== 'fetch') {
        return {
            ok: false,
            code: 'cvo::server_artifact::entry_not_fetch',
            messageKey: 'cvo.server_artifact.entry_not_fetch',
        };
    }

    if (!Array.isArray(record.publicRoutes)) {
        return {
            ok: false,
            code: 'cvo::server_artifact::public_routes_missing',
            messageKey: 'cvo.server_artifact.public_routes_missing',
        };
    }

    if (!Array.isArray(record.internalCapabilities)) {
        return {
            ok: false,
            code: 'cvo::server_artifact::internal_capabilities_missing',
            messageKey: 'cvo.server_artifact.internal_capabilities_missing',
        };
    }

    for (const route of record.publicRoutes) {
        if (typeof route !== 'object' || route === null) {
            return {
                ok: false,
                code: 'cvo::server_artifact::public_route_invalid',
                messageKey: 'cvo.server_artifact.public_route_invalid',
            };
        }
        const r = route as Record<string, unknown>;
        if (typeof r.verb !== 'string' || typeof r.path !== 'string' || typeof r.moduleId !== 'string' || typeof r.method !== 'string') {
            return {
                ok: false,
                code: 'cvo::server_artifact::public_route_invalid',
                messageKey: 'cvo.server_artifact.public_route_invalid',
            };
        }
    }

    if (record.secretRequirements !== undefined) {
        if (!Array.isArray(record.secretRequirements)) {
            return {
                ok: false,
                code: 'cvo::server_artifact::secret_requirements_invalid',
                messageKey: 'cvo.server_artifact.secret_requirements_invalid',
            };
        }
        for (const secret of record.secretRequirements) {
            if (typeof secret !== 'object' || secret === null || typeof (secret as Record<string, unknown>).id !== 'string') {
                return {
                    ok: false,
                    code: 'cvo::server_artifact::secret_requirement_invalid',
                    messageKey: 'cvo.server_artifact.secret_requirement_invalid',
                };
            }
            const s = secret as Record<string, unknown>;
            if ('value' in s || 'secret' in s) {
                return {
                    ok: false,
                    code: 'cvo::server_artifact::secret_value_forbidden',
                    messageKey: 'cvo.server_artifact.secret_value_forbidden',
                };
            }
        }
    }

    return { ok: true, code: 'cvo::server_artifact::valid', messageKey: 'cvo.server_artifact.valid', artifact: value as VmzServerArtifact };
}

/** Build capability manifest for a public route operation. */
export function capabilityManifestForRoute(route: VmzPublicRoute): CvoCapabilityManifest {
    const requirements: CvoCapabilityRequirement[] = (route.requiredCapabilities ?? []).map((id) => ({
        schema: CVO_CAPABILITY_SCHEMA,
        id,
    }));
    return {
        schema: CVO_CAPABILITY_MANIFEST_SCHEMA,
        requirements,
    };
}

/** Secret requirement declarations only — never includes values. */
export function secretRequirementsFromArtifact(artifact: VmzServerArtifact): readonly VmzSecretRequirement[] {
    return artifact.secretRequirements ?? [];
}

/** Capability diagnostics for static / server-host / test-host profiles. */
export function diagnoseServerArtifactForHost(artifact: VmzServerArtifact, profile: CvoHostProfile): CvoHostCapabilityDiagnostic {
    const notes: string[] = [];
    const assembly = artifact.assembly ?? 'unknown';
    const runtime = artifact.selectedRuntime ?? 'unknown';

    if (profile === 'static') {
        if (assembly === 'server-host') {
            return {
                profile,
                ok: false,
                code: 'cvo::server_artifact::static_cannot_host_server_slice',
                messageKey: 'cvo.server_artifact.static_cannot_host_server_slice',
                notes: ['ServerArtifact assembly server-host requires server-host or worker profile, not static CDN only'],
            };
        }
        notes.push('static profile: artifact loaded for contract validation only');
        return {
            profile,
            ok: true,
            code: 'cvo::server_artifact::static_ok',
            messageKey: 'cvo.server_artifact.static_ok',
            notes,
        };
    }

    if (profile === 'server-host') {
        if (assembly !== 'server-host' && assembly !== 'cdn+server') {
            notes.push(`assembly=${assembly} may not emit live server routes`);
        }
        if (runtime === 'node' || runtime === 'worker') {
            return {
                profile,
                ok: true,
                code: 'cvo::server_artifact::server_host_ok',
                messageKey: 'cvo.server_artifact.server_host_ok',
                notes,
            };
        }
        return {
            profile,
            ok: false,
            code: 'cvo::server_artifact::server_host_runtime_mismatch',
            messageKey: 'cvo.server_artifact.server_host_runtime_mismatch',
            notes: [`selectedRuntime=${runtime}`],
        };
    }

    notes.push('test-host uses fake bindings; secret values are never loaded from artifact');
    return {
        profile,
        ok: true,
        code: 'cvo::server_artifact::test_host_ok',
        messageKey: 'cvo.server_artifact.test_host_ok',
        notes,
    };
}

export function serverArtifactDiagnostic(decision: VmzServerArtifactDecision): CvoDiagnostic {
    return artifactDiagnostic(decision.code, decision.messageKey);
}
