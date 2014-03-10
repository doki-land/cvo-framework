import {
    diagnoseServerArtifactForHost,
    type CvoHostProfile,
    validateServerArtifact,
    type VmzServerArtifact,
} from '@cvo/core';
import type { CvoRequestHandler } from './host.js';
import { createRouteFetchService, type CvoRouteFetchServiceOptions } from './worker-routes.js';
import {
    CVO_VMZ_SERVER_ARTIFACT_CONTRACT_ID,
    handlersFromOperationMap,
    hostCapabilityManifest,
    internalCapabilityIds,
    publicRouteCapabilityIds,
    serverArtifactToRouteTable,
} from './server-artifact-adapter.js';

export interface CvoServerArtifactHostOptions {
    readonly artifact: VmzServerArtifact;
    readonly handlers: Readonly<Record<string, CvoRequestHandler>>;
    readonly contractId?: string;
    readonly availableCapabilities?: readonly string[];
    readonly defaultTimeoutMs?: number;
    readonly hostProfile?: CvoHostProfile;
}

export interface CvoServerArtifactHostDiagnostics {
    readonly profile: CvoHostProfile;
    readonly artifactValid: boolean;
    readonly hostCapability: ReturnType<typeof diagnoseServerArtifactForHost>;
    readonly publicCapabilityIds: readonly string[];
    readonly internalCapabilityIds: readonly string[];
    readonly secretRequirementIds: readonly string[];
}

/** Load and validate ServerArtifact JSON text. */
export function loadServerArtifact(json: unknown): VmzServerArtifact {
    const decision = validateServerArtifact(json);
    if (!decision.ok || !decision.artifact) {
        throw new Error(decision.messageKey);
    }
    return decision.artifact;
}

/** Collect capability diagnostics for static / server-host / test-host profiles. */
export function serverArtifactHostDiagnostics(
    artifact: VmzServerArtifact,
    profile: CvoHostProfile = 'test-host',
): CvoServerArtifactHostDiagnostics {
    const valid = validateServerArtifact(artifact);
    return {
        profile,
        artifactValid: valid.ok,
        hostCapability: diagnoseServerArtifactForHost(artifact, profile),
        publicCapabilityIds: publicRouteCapabilityIds(artifact),
        internalCapabilityIds: internalCapabilityIds(artifact),
        secretRequirementIds: (artifact.secretRequirements ?? []).map((s) => s.id),
    };
}

/**
 * Create a Fetch service from a VMZ ServerArtifact + CVO handlers.
 * Does not bypass VMZ createRenderHost — only consumes compiled artifact contracts.
 */
export function createServerArtifactFetchService(options: CvoServerArtifactHostOptions): (request: Request) => Promise<Response> {
    const contractId = options.contractId ?? CVO_VMZ_SERVER_ARTIFACT_CONTRACT_ID;
    const profile = options.hostProfile ?? 'test-host';
    const hostDiag = diagnoseServerArtifactForHost(options.artifact, profile);
    if (!hostDiag.ok) {
        throw new Error(hostDiag.messageKey);
    }

    const routeTable = serverArtifactToRouteTable(options.artifact, contractId);
    const handlers = handlersFromOperationMap(options.handlers);
    const required = publicRouteCapabilityIds(options.artifact);

    const routeOptions: CvoRouteFetchServiceOptions = {
        routeTable,
        handlers,
        availableCapabilities: options.availableCapabilities ?? required,
        defaultTimeoutMs: options.defaultTimeoutMs,
    };

    return createRouteFetchService(routeOptions);
}

/** Expose required host capabilities derived from artifact (declarations only). */
export function serverArtifactRequiredCapabilities(artifact: VmzServerArtifact): ReturnType<typeof hostCapabilityManifest> {
    return hostCapabilityManifest(publicRouteCapabilityIds(artifact));
}
