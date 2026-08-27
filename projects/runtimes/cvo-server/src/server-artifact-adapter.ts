import {
    CVO_CAPABILITY_MANIFEST_SCHEMA,
    CVO_CAPABILITY_SCHEMA,
    CVO_INVOCATION_SCHEMA,
    CVO_TRACE_CONTEXT_SCHEMA,
    CVO_TRANSPORT_SCHEMA,
    type CvoInvocation,
    type CvoRouteDefinition,
    type CvoRouteTable,
    capabilityManifestForRoute,
    createRouteTable,
    parseVmzOperationId,
    secretRequirementsFromArtifact,
    type VmzPublicRoute,
    type VmzServerArtifact,
    vmzOperationId,
} from '@cvo/core';
import type { CvoRequestHandler } from './host.js';
import { httpFetchTransport } from './test-host.js';

export const CVO_VMZ_SERVER_ARTIFACT_CONTRACT_ID = 'cvo.vmz.server-artifact.v1';

export interface CvoRequestContext {
    readonly request: Request;
    readonly url: URL;
    readonly method: string;
    readonly pathParams: Readonly<Record<string, string>>;
    readonly query: Readonly<Record<string, string>>;
    readonly locale?: string;
    readonly signal: AbortSignal;
    readonly operationId: string;
    readonly route: VmzPublicRoute;
    readonly capabilityRequirements: ReturnType<typeof capabilityManifestForRoute>;
    readonly secretRequirements: ReturnType<typeof secretRequirementsFromArtifact>;
}

/** Map VMZ ServerArtifact public routes to a CVO static route table. */
export function serverArtifactToRouteTable(artifact: VmzServerArtifact, contractId = CVO_VMZ_SERVER_ARTIFACT_CONTRACT_ID): CvoRouteTable {
    const routes: CvoRouteDefinition[] = artifact.publicRoutes.map((route) => ({
        operationId: vmzOperationId(route.moduleId, route.method),
        method: normalizeHttpMethod(route.verb),
        path: route.path,
        query: route.query?.map((q) => ({ name: q.name, required: q.required })),
        body: 'none',
    }));
    return createRouteTable(contractId, routes);
}

function normalizeHttpMethod(verb: string): CvoRouteDefinition['method'] {
    const upper = verb.toUpperCase();
    if (upper === 'GET' || upper === 'POST' || upper === 'PUT' || upper === 'PATCH' || upper === 'DELETE') {
        return upper;
    }
    return 'GET';
}

/** Build RequestContext from a matched Fetch request (no secret values). */
export function createRequestContext(
    request: Request,
    route: VmzPublicRoute,
    pathParams: Readonly<Record<string, string>>,
    query: Readonly<Record<string, string>>,
    artifact: VmzServerArtifact,
): CvoRequestContext {
    const url = new URL(request.url);
    const locale = request.headers.get('accept-language')?.split(',')[0]?.trim();
    return {
        request,
        url,
        method: request.method.toUpperCase(),
        pathParams,
        query,
        locale: locale || undefined,
        signal: request.signal,
        operationId: vmzOperationId(route.moduleId, route.method),
        route,
        capabilityRequirements: capabilityManifestForRoute(route),
        secretRequirements: secretRequirementsFromArtifact(artifact),
    };
}

/** Build CVO invocation envelope from RequestContext + route input. */
export function invocationFromRequestContext(
    ctx: CvoRequestContext,
    input: Record<string, unknown>,
    contractId = CVO_VMZ_SERVER_ARTIFACT_CONTRACT_ID,
): CvoInvocation {
    const traceId = ctx.request.headers.get('traceparent')?.split('-')[1];
    return {
        schema: CVO_INVOCATION_SCHEMA,
        contractId,
        operationId: ctx.operationId,
        transport: {
            ...httpFetchTransport(ctx.url.pathname, ctx.method),
            schema: CVO_TRANSPORT_SCHEMA,
        },
        input,
        capabilities: ctx.capabilityRequirements,
        deadline: ctx.request.headers.get('x-deadline') ?? undefined,
        traceContext: {
            schema: CVO_TRACE_CONTEXT_SCHEMA,
            requestId: ctx.request.headers.get('x-request-id') ?? crypto.randomUUID(),
            traceId,
            spanId: ctx.request.headers.get('x-span-id') ?? undefined,
        },
    };
}

/** Register handlers keyed by VMZ operation id (`moduleId::method`). */
export function handlersFromOperationMap(handlers: Readonly<Record<string, CvoRequestHandler>>): Readonly<Record<string, CvoRequestHandler>> {
    const out: Record<string, CvoRequestHandler> = {};
    for (const [operationId, handler] of Object.entries(handlers)) {
        out[operationId] = handler;
        const parsed = parseVmzOperationId(operationId);
        if (parsed) {
            out[vmzOperationId(parsed.moduleId, parsed.method)] = handler;
        }
    }
    return out;
}

/** Map internal capabilities to optional host capability ids (for diagnostics). */
export function internalCapabilityIds(artifact: VmzServerArtifact): readonly string[] {
    return artifact.internalCapabilities.map((cap) => vmzOperationId(cap.moduleId, cap.method));
}

/** Required capability ids declared on public routes. */
export function publicRouteCapabilityIds(artifact: VmzServerArtifact): readonly string[] {
    const ids = new Set<string>();
    for (const route of artifact.publicRoutes) {
        for (const id of route.requiredCapabilities ?? []) {
            ids.add(id);
        }
    }
    return [...ids];
}

/** Build capability manifest for host availability checks. */
export function hostCapabilityManifest(requiredIds: readonly string[]): {
    schema: typeof CVO_CAPABILITY_MANIFEST_SCHEMA;
    requirements: { schema: typeof CVO_CAPABILITY_SCHEMA; id: string }[];
} {
    return {
        schema: CVO_CAPABILITY_MANIFEST_SCHEMA,
        requirements: requiredIds.map((id) => ({
            schema: CVO_CAPABILITY_SCHEMA,
            id,
        })),
    };
}
