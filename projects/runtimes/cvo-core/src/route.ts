import { CVO_DIAGNOSTIC_SCHEMA, type CvoDiagnostic } from './contract.js';

export const CVO_ROUTE_TABLE_SCHEMA = 'cvo.route_table.v1';

export type CvoHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface CvoRouteQueryParam {
    readonly name: string;
    readonly required?: boolean;
}

export interface CvoRouteDefinition {
    readonly operationId: string;
    readonly method: CvoHttpMethod;
    /** Path pattern with `:param` segments, e.g. `/data/:id`. */
    readonly path: string;
    readonly query?: readonly CvoRouteQueryParam[];
    readonly body?: 'json' | 'none';
}

export interface CvoRouteTable {
    readonly schema: typeof CVO_ROUTE_TABLE_SCHEMA;
    readonly contractId: string;
    readonly routes: readonly CvoRouteDefinition[];
}

export interface CvoRouteMatch {
    readonly route: CvoRouteDefinition;
    readonly pathParams: Readonly<Record<string, string>>;
}

export interface CvoDecodedRouteRequest {
    readonly operationId: string;
    readonly pathParams: Readonly<Record<string, string>>;
    readonly query: Readonly<Record<string, string>>;
    readonly body: unknown;
}

function routeDiagnostic(code: string, messageKey: string, args?: Readonly<Record<string, unknown>>): CvoDiagnostic {
    return {
        schema: CVO_DIAGNOSTIC_SCHEMA,
        code,
        messageKey,
        severity: 'error',
        args,
    };
}

function splitPath(pathname: string): string[] {
    return pathname.split('/').filter(Boolean);
}

function matchPathPattern(pattern: string, pathname: string): Readonly<Record<string, string>> | undefined {
    const patternParts = splitPath(pattern);
    const pathParts = splitPath(pathname);
    if (patternParts.length !== pathParts.length) {
        return undefined;
    }

    const params: Record<string, string> = {};
    for (let i = 0; i < patternParts.length; i += 1) {
        const segment = patternParts[i] ?? '';
        const value = pathParts[i] ?? '';
        if (segment.startsWith(':')) {
            params[segment.slice(1)] = decodeURIComponent(value);
            continue;
        }
        if (segment !== value) {
            return undefined;
        }
    }
    return params;
}

/** Match a static route table entry against method and pathname. */
export function matchRoute(table: CvoRouteTable, method: string, pathname: string): CvoRouteMatch | undefined {
    const normalizedPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    for (const route of table.routes) {
        if (route.method !== method) {
            continue;
        }
        const pathParams = matchPathPattern(route.path, normalizedPath);
        if (pathParams) {
            return { route, pathParams };
        }
    }
    return undefined;
}

/** Decode query string parameters for a matched route. */
export function decodeRouteQuery(
    searchParams: URLSearchParams,
    route: CvoRouteDefinition,
): { ok: true; query: Readonly<Record<string, string>> } | { ok: false; diagnostic: CvoDiagnostic } {
    const query: Record<string, string> = {};
    for (const spec of route.query ?? []) {
        const value = searchParams.get(spec.name);
        if (value === null || value === '') {
            if (spec.required) {
                return {
                    ok: false,
                    diagnostic: routeDiagnostic('cvo::route::query_missing', 'cvo.route.query_missing', {
                        name: spec.name,
                    }),
                };
            }
            continue;
        }
        query[spec.name] = value;
    }
    return { ok: true, query };
}

/** Decode JSON or empty body according to route definition. */
export async function decodeRouteBody(
    request: Request,
    route: CvoRouteDefinition,
): Promise<{ ok: true; body: unknown } | { ok: false; diagnostic: CvoDiagnostic }> {
    const kind = route.body ?? 'none';
    if (kind === 'none') {
        return { ok: true, body: undefined };
    }

    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
        return {
            ok: false,
            diagnostic: routeDiagnostic('cvo::route::body_content_type', 'cvo.route.body_content_type'),
        };
    }

    try {
        return { ok: true, body: await request.json() };
    } catch {
        return {
            ok: false,
            diagnostic: routeDiagnostic('cvo::route::body_invalid_json', 'cvo.route.body_invalid_json'),
        };
    }
}

/** Build typed route input envelope for handlers. */
export function buildRouteInput(match: CvoRouteMatch, query: Readonly<Record<string, string>>, body: unknown): Record<string, unknown> {
    return {
        path: match.pathParams,
        query,
        body,
    };
}

/** Create a static route table document. */
export function createRouteTable(contractId: string, routes: readonly CvoRouteDefinition[]): CvoRouteTable {
    return {
        schema: CVO_ROUTE_TABLE_SCHEMA,
        contractId,
        routes,
    };
}
