import {DevixError} from '@devlusoft/devix'
import {errorToBody, isRedirect, isLoaderError} from '../utils/response'
import {createTurboResponse, decodeFromRequest} from '../utils/turbo-serializer'

interface ActionsGlob {
    actions: Record<string, () => Promise<Record<string, Function>>>
}

function normalizeActionKey(key: string): string {
    const idx = key.indexOf('/actions/')
    if (idx === -1) return key
    return key
        .slice(idx + '/actions/'.length)
        .replace(/\.(ts|tsx)$/, '')
        .replace(/\//g, '_')
}

export async function handleActionRequest(
    url: string,
    request: Request,
    glob: ActionsGlob,
): Promise<Response> {
    try {
        const {pathname} = new URL(url, 'http://localhost')

        const match = pathname.match(/^\/_devix\/actions\/(.+?)\/(.+)$/)
        if (!match) return new Response('Not Found', {status: 404})

        const fileRel = match[1]
        const fnName = match[2]

        const actionKeys = Object.keys(glob.actions)
        const matchedKey = actionKeys.find(k => normalizeActionKey(k) === fileRel)
        if (!matchedKey) return new Response('Not Found', {status: 404})

        const mod = await glob.actions[matchedKey]() as Record<string, Function>
        const fn = mod[fnName]
        if (typeof fn !== 'function') return new Response('Not Found', {status: 404})

        const ct = request.headers.get('Content-Type') ?? ''
        let args: unknown[] = []
        if (request.method !== 'GET' && request.body) {
            if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
                args = [await request.formData()]
            } else if (ct.includes('application/octet-stream') || ct.includes('application/x-turbo')) {
                const decoded = await decodeFromRequest(request)
                args = Array.isArray(decoded) ? decoded : [decoded]
            } else if (ct.includes('application/json')) {
                const decoded = await request.json()
                args = Array.isArray(decoded) ? decoded : [decoded]
            } else {
                args = [await request.text()]
            }
        }

        const result = await fn(...args)

        if (isRedirect(result)) {
            return new Response(JSON.stringify({
                redirect: result.url,
                redirectStatus: result.status,
                redirectReplace: result.replace,
            }), {
                status: result.status,
                headers: {'Content-Type': 'application/json'},
            })
        }

        if (isLoaderError(result)) {
            const errBody = errorToBody(result)
            return new Response(JSON.stringify(errBody), {
                status: errBody.statusCode,
                headers: {'Content-Type': 'application/json'},
            })
        }

        return createTurboResponse(result, request.signal)
    } catch (err) {
        if (err instanceof DevixError) {
            const body = errorToBody(err)
            return new Response(JSON.stringify(body), {
                status: body.statusCode,
                headers: {'Content-Type': 'application/json'},
            })
        }
        console.error('[devix] action error:', err)
        return new Response(JSON.stringify({
            statusCode: 500, message: 'Internal Server Error',
        }), {status: 500, headers: {'Content-Type': 'application/json'}})
    }
}
