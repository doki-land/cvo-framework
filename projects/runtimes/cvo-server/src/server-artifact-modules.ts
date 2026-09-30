import { CVO_RESULT_SCHEMA, type CvoResult, type VmzServerArtifact, vmzOperationId } from '@cvo/core';
import type { CvoRequestHandler } from './host.js';

export type CvoServerModuleNamespace = {
    readonly default?: unknown;
    readonly [exportName: string]: unknown;
};

export type CvoServerModuleResolver = (moduleId: string) => Promise<CvoServerModuleNamespace>;

/**
 * Build CVO handlers that invoke compiled VMZ `#server` classes from a ServerArtifact.
 * Mirrors VMZ `callServerLocal`: construct default export, call route method.
 * Does not invent an author API — only hosts the VMZ-emitted server slice.
 */
export function createServerArtifactModuleHandlers(
    artifact: VmzServerArtifact,
    resolveModule: CvoServerModuleResolver,
): Readonly<Record<string, CvoRequestHandler>> {
    const handlers: Record<string, CvoRequestHandler> = {};

    for (const route of artifact.publicRoutes) {
        const operationId = vmzOperationId(route.moduleId, route.method);
        handlers[operationId] = async (invocation): Promise<CvoResult> => {
            const mod = await resolveModule(route.moduleId);
            const Ctor = resolveServerCtor(mod, route.moduleId, route.className);
            const instance = new Ctor() as Record<string, unknown>;
            const fn = instance[route.method];
            if (typeof fn !== 'function') {
                throw new Error(`cvo.server_artifact.method_missing:${route.moduleId}.${route.method}`);
            }

            const verb = route.verb.toUpperCase();
            const input = invocation.input as { body?: unknown } | undefined;
            const args = verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS' ? [] : [input?.body ?? {}];
            const body = await (fn as (...a: unknown[]) => Promise<unknown>).apply(instance, args);

            return {
                schema: CVO_RESULT_SCHEMA,
                status: 200,
                body,
            };
        };
    }

    return handlers;
}

function resolveServerCtor(
    mod: CvoServerModuleNamespace,
    moduleId: string,
    className?: string | null,
): new () => unknown {
    if (typeof mod.default === 'function') {
        return mod.default as new () => unknown;
    }
    if (className && typeof mod[className] === 'function') {
        return mod[className] as new () => unknown;
    }
    const guessed = `${moduleId.split('/').pop() || 'Server'}Server`;
    if (typeof mod[guessed] === 'function') {
        return mod[guessed] as new () => unknown;
    }
    throw new Error(`cvo.server_artifact.class_missing:${moduleId}`);
}
