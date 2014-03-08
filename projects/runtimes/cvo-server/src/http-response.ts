import { CVO_RESULT_SCHEMA, type CvoDiagnostic, type CvoResult, toPublicDiagnostic } from '@cvo/core';

/** JSON response using Web Response only. */
export function jsonHttpResponse(body: unknown, status = 200, headers?: Readonly<Record<string, string>>): Response {
    const responseHeaders = new Headers(headers);
    if (!responseHeaders.has('content-type')) {
        responseHeaders.set('content-type', 'application/json; charset=utf-8');
    }
    return Response.json(body, { status, headers: responseHeaders });
}

/** Redirect response. */
export function redirectHttpResponse(location: string, status: 301 | 302 | 303 | 307 | 308 = 302): Response {
    return new Response(null, {
        status,
        headers: { location },
    });
}

/** Error response from a CVO diagnostic. */
export function errorHttpResponse(diagnostic: CvoDiagnostic, status = 400): Response {
    return jsonHttpResponse(
        {
            schema: diagnostic.schema,
            code: diagnostic.code,
            messageKey: diagnostic.messageKey,
            severity: diagnostic.severity,
            requestId: diagnostic.requestId,
        },
        status,
    );
}

/** Map a CVO result to a Fetch Response (JSON body or redirect). */
export function resultToHttpResponse(result: CvoResult): Response {
    if (result.headers?.location && result.status >= 300 && result.status < 400) {
        return redirectHttpResponse(result.headers.location, result.status as 301 | 302 | 303 | 307 | 308);
    }

    const headers = new Headers(result.headers);
    if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json; charset=utf-8');
    }

    const body = {
        schema: result.schema,
        status: result.status,
        body: result.body,
        diagnostic: result.diagnostic ? toPublicDiagnostic(result.diagnostic) : undefined,
    };

    return Response.json(body, { status: result.status, headers });
}

/** Build a typed JSON success result. */
export function jsonResult(body: unknown, status = 200, headers?: Readonly<Record<string, string>>): CvoResult {
    return {
        schema: CVO_RESULT_SCHEMA,
        status,
        body,
        headers,
    };
}

/** Build a redirect result. */
export function redirectResult(location: string, status: 302 | 307 = 302): CvoResult {
    return {
        schema: CVO_RESULT_SCHEMA,
        status,
        headers: { location },
    };
}
