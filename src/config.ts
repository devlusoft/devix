import type { UserConfig } from "vite"
export {getCookie, setCookie, deleteCookie} from './utils/cookies'
export type {CookieOptions} from './utils/cookies'

export interface PrepareContext {
    /** Request entrante del cliente. */
    request: Request
    /** Headers mutables que se enviarán al backend. Agrega aquí auth, tracing, tenant, etc. */
    headers: Headers
    /** URL mutable de destino. Puedes reescribir `pathname` antes de proxear. */
    url: URL
}

export interface ServerBackendConfig {
    /**
     * URL base del backend. Todas las paths del namespace se anteponen a esta URL.
     * Ej: `process.env.API_URL` → `'http://localhost:8080'`
     */
    url: string

    /**
     * Hook que corre antes de proxear cada request. Recibe el `Request` del cliente,
     * los `headers` mutables que irán al backend, y la `url` mutable de destino.
     *
     * - Retorna `void` para continuar con el proxy.
     * - Retorna `Response` para cortar y devolverle ese response al cliente (útil para 401, 429, etc.).
     *
     * Solo úsalo para pass-through de credenciales del usuario (cookies, sesión). Para
     * APIs de terceros con keys del server (Stripe, SendGrid), usa un handler explícito en
     * `app/api/` con autorización propia.
     */
    prepare?: (ctx: PrepareContext) => Response | void | Promise<Response | void>

    /**
     * Lista de paths permitidos (glob). Sin esto, el proxy responde 403 a todo
     * (deny-all por defecto). Defense in depth.
     *
     * Ej: `['/v1/**', '/v2/users/**']`
     */
    allowedPaths?: string[]

    /**
     * Lista de paths explícitamente denegados, evaluada después de `allowedPaths`.
     *
     * Ej: `['/v1/admin/internal/**']`
     */
    deniedPaths?: string[]
}

export interface DevixConfig {
    port?: number
    host?: string | boolean
    css?: string[]
    appDir?: string
    publicDir?: string
    envPrefix?: string | string[]
    html?: { lang?: string }
    vite?: UserConfig
    output?: 'server' | 'static'
    /**
     * Backends remotos accesibles vía `$server.<namespace>.<method>(path)`.
     *
     * Cada namespace se proxy-ea en `/_devix/server/<namespace>/<path>` para el cliente,
     * y se hace fetch directo desde el server (loaders/handlers vía `ctx.$server`).
     *
     * Ejemplo:
     * ```ts
     * server: {
     *   api: {
     *     url: process.env.API_URL!,
     *     prepare: ({ request, headers }) => {
     *       const sid = getCookie(request, 'sid')
     *       if (sid) headers.set('Authorization', `Bearer ${sid}`)
     *     },
     *     allowedPaths: ['/v1/**'],
     *   },
     * }
     * ```
     */
    server?: Record<string, ServerBackendConfig>
}

export interface ResolvedDirs {
    appDir: string
    pagesDir: string
    apiDir: string
}

export function defineConfig(config: DevixConfig): DevixConfig {
    validateServerConfig(config.server)
    return config
}

export function resolveDirs(config: DevixConfig): ResolvedDirs {
    const appDir = config.appDir ?? "app"
    return {
        appDir,
        pagesDir: `${appDir}/pages`,
        apiDir: `${appDir}/api`,
    }
}

const NAMESPACE_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/

function validateServerConfig(server: DevixConfig['server']): void {
    if (!server) return
    for (const [name, cfg] of Object.entries(server)) {
        if (!NAMESPACE_RE.test(name)) {
            throw new Error(
                `[devix] Invalid server namespace "${name}". Must match /^[a-zA-Z][a-zA-Z0-9_]*$/.`
            )
        }
        if (!cfg.url || typeof cfg.url !== 'string') {
            throw new Error(`[devix] server.${name}.url is required and must be a string.`)
        }
        try {
            new URL(cfg.url)
        } catch {
            throw new Error(`[devix] server.${name}.url is not a valid URL: "${cfg.url}".`)
        }
        if (!cfg.allowedPaths || cfg.allowedPaths.length === 0) {
            console.warn(
                `[devix] server.${name} has no allowedPaths configured — proxy will respond 403 to all requests. ` +
                `Add at least one glob (e.g. allowedPaths: ['/v1/**']) to enable the proxy.`
            )
        }
    }
}