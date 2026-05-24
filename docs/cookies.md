# Cookies

devix ofrece `getCookie`, `setCookie` y `deleteCookie` con dos modos de uso: **implícito** (sin pasar request/headers) y **explícito** (pasando request/headers manualmente).

## API

```ts
import { getCookie, setCookie, deleteCookie } from '@devlusoft/devix'
```

### Implícito (recomendado para queries y actions)

Dentro de queries, actions y SSR, el `Request` y los `Headers` de respuesta están disponibles automáticamente vía `AsyncLocalStorage`. No necesitas pasar nada:

```ts
// query
export const getMe = query(async () => {
  const token = getCookie('session')
  if (!token) return null
  return verifyToken(token)
}, 'me')

// action
export const login = action(async (token: string) => {
  setCookie('session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
  })
  return { ok: true }
})

// action — delete
export const logout = action(async () => {
  deleteCookie('session')
  return { ok: true }
})
```

| Función | Lee `request` de | Escribe `Set-Cookie` en |
|---|---|---|
| `getCookie(name)` | `AsyncLocalStorage` (request del handler) | — |
| `setCookie(name, value, opts?)` | — | `AsyncLocalStorage` (responseHeaders) |
| `deleteCookie(name, opts?)` | — | `AsyncLocalStorage` (responseHeaders) |

### Explícito

En contextos fuera del ALS (ej. `prepare` en config, middleware API), debes pasar el request o headers explícitamente:

```ts
import { getCookie, setCookie, deleteCookie, json } from '@devlusoft/devix'
import type { RouteHandler } from '@devlusoft/devix'

// API route — set
export const POST: RouteHandler = async (ctx) => {
  const { email, password } = await ctx.request.json()
  const token = await createSession(email, password)
  if (!token) return json({ error: 'Credenciales inválidas' }, 401)

  const res = json({ ok: true })
  setCookie(res.headers, 'session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 7,
  })
  return res
}

// API route — delete
export const DELETE: RouteHandler = async () => {
  const res = json({ ok: true })
  deleteCookie(res.headers, 'session')
  return res
}

// API middleware — read
export const middleware: MiddlewareModule['middleware'] = async (ctx) => {
  const token = getCookie(ctx.request, 'session')
  if (!token) return new Response('Unauthorized', { status: 401 })
  ctx.set('user', await verifyToken(token))
  return null
}

// prepare en $server
prepare: ({ request, headers }) => {
  const sid = getCookie(request, 'sid')
  if (sid) headers.set('Authorization', `Bearer ${sid}`)
}
```

| Función | Parámetros |
|---|---|
| `getCookie(request, name)` | Request nativo + nombre |
| `getCookie(headerString, name)` | string de header `Cookie` + nombre |
| `setCookie(headers, name, value, opts?)` | Headers de respuesta + nombre + valor + opciones |
| `deleteCookie(headers, name)` | Headers de respuesta + nombre |

## ¿Implícito o explícito?

| Contexto | Modo | Razón |
|---|---|---|
| Query (`query()`) | Implícito | ALS activo durante RPC |
| Action (`action()`) | Implícito | ALS activo durante RPC |
| SSR (páginas renderizadas) | Implícito | ALS activo durante render |
| API route handler | Explícito | No hay ALS, tienes `ctx.request` y `res.headers` |
| API middleware | Explícito | No hay ALS, tienes `ctx.request` |
| `$server.prepare` | Explícito | No hay ALS, recibes `{ request, headers }` |
| Cliente (navegador) | No disponible | `getCookie()` retorna `undefined`, set/delete son no-op |

## CookieOptions

```ts
interface CookieOptions {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
  maxAge?: number
  expires?: Date
  path?: string    // default: '/'
  domain?: string
}
```
