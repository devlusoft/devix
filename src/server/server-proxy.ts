import type {ServerBackendConfig, PrepareContext} from '../config'
import {matchesAnyGlob} from '../utils/glob'
import {errorToBody} from '../utils/response'

const PROXY_PREFIX = '/_devix/server'

function jsonError(statusCode: number, message: string, code?: string): Response {
    const body = errorToBody({statusCode, message, code})
    return new Response(JSON.stringify(body), {
        status: statusCode,
        headers: {'Content-Type': 'application/json'},
    })
}

/**
 * Parsea `/_devix/server/<namespace>/<path>` → `{namespace, path}`.
 * Retorna null si el path no es un request al proxy.
 */
export function parseProxyPath(pathname: string): {namespace: string; path: string} | null {
    if (!pathname.startsWith(PROXY_PREFIX + '/')) return null
    const rest = pathname.slice(PROXY_PREFIX.length + 1)
    const slash = rest.indexOf('/')
    if (slash === -1) {
        return {namespace: rest, path: '/'}
    }
    return {namespace: rest.slice(0, slash), path: rest.slice(slash)}
}

/**
 * Maneja un request entrante al proxy interno. Aplica allowlist/denylist,
 * ejecuta `prepare`, y reenvía al backend configurado.
 */
export async function handleProxyRequest(
    request: Request,
    config: Record<string, ServerBackendConfig> | undefined,
): Promise<Response> {
    const url = new URL(request.url)
    const parsed = parseProxyPath(url.pathname)
    if (!parsed) {
        return jsonError(404, 'Not found', 'PROXY_NOT_FOUND')
    }

    const backend = config?.[parsed.namespace]
    if (!backend) {
        return jsonError(404, `Backend "${parsed.namespace}" not configured`, 'BACKEND_NOT_FOUND')
    }

    if (!matchesAnyGlob(parsed.path, backend.allowedPaths)) {
        return jsonError(403, 'Path not allowed', 'PATH_NOT_ALLOWED')
    }
    if (matchesAnyGlob(parsed.path, backend.deniedPaths)) {
        return jsonError(403, 'Path denied', 'PATH_DENIED')
    }

    const targetUrl = new URL(parsed.path + url.search, backend.url)
    const headers = new Headers()

    if (backend.prepare) {
        const ctx: PrepareContext = {request, headers, url: targetUrl}
        try {
            const result = await backend.prepare(ctx)
            if (result instanceof Response) return result
        } catch (err) {
            console.error(`[devix] server.${parsed.namespace}.prepare error:`, err)
            return jsonError(500, 'Proxy prepare failed', 'PREPARE_ERROR')
        }
    }

    if (!headers.has('Accept')) {
        const accept = request.headers.get('Accept')
        if (accept) headers.set('Accept', accept)
    }
    const ct = request.headers.get('Content-Type')
    if (ct && !headers.has('Content-Type')) headers.set('Content-Type', ct)

    let body: BodyInit | null = null
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        body = await request.arrayBuffer()
        if ((body as ArrayBuffer).byteLength === 0) body = null
    }

    try {
        const backendRes = await fetch(targetUrl, {
            method: request.method,
            headers,
            body,
            redirect: 'manual',
        })
        return new Response(backendRes.body, {
            status: backendRes.status,
            statusText: backendRes.statusText,
            headers: filterHopByHop(backendRes.headers),
        })
    } catch (err) {
        console.error(`[devix] server.${parsed.namespace} fetch error:`, err)
        return jsonError(502, 'Bad Gateway', 'BACKEND_UNREACHABLE')
    }
}

const HOP_BY_HOP = new Set([
    'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
    'te', 'trailers', 'transfer-encoding', 'upgrade',
])

function filterHopByHop(src: Headers): Headers {
    const dst = new Headers()
    src.forEach((value, key) => {
        if (!HOP_BY_HOP.has(key.toLowerCase())) dst.set(key, value)
    })
    return dst
}

export const PROXY_PATH_PREFIX = PROXY_PREFIX
