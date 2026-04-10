# Rutas API

Los archivos dentro de `app/api/` se convierten en endpoints HTTP.

## Estructura

| Archivo                  | Endpoint         |
|--------------------------|------------------|
| `app/api/health.ts`      | `/api/health`    |
| `app/api/posts/index.ts` | `/api/posts`     |
| `app/api/posts/[id].ts`  | `/api/posts/:id` |

## createHandler

`createHandler` es la forma recomendada de definir handlers. Infiere automáticamente el tipo del body y del retorno, lo que habilita tipado de extremo a extremo con `$fetch`.

```ts
// app/api/auth/login.ts
import { createHandler, json } from '@devlusoft/devix'

export const POST = createHandler(async (body: { email: string; password: string }) => {
  const token = await createSession(body.email, body.password)
  if (!token) return json({ error: 'Credenciales inválidas' }, 401)
  return json({ ok: true })
})

export const GET = createHandler(async () => {
  return json({ status: 'ok' })
})
```

devix parsea el body automáticamente según el `Content-Type` del request:
- `application/json` → `req.json()`
- `multipart/form-data` / `application/x-www-form-urlencoded` → `req.formData()`
- cualquier otro → `req.text()`

El tipo del parámetro en el handler **define** el tipo del body — no se pasa tipo genérico explícito:

```ts
export const POST = createHandler(async (body: { email: string; password: string }) => { ... })
```

## RouteHandler (handler clásico)

Para casos donde necesitas acceso directo a `ctx` o `req`:

```ts
import { json, type RouteHandler } from '@devlusoft/devix'

export const GET: RouteHandler = async (ctx, req) => {
  return { hello: ctx.params.id }
}

export const POST: RouteHandler = async (ctx, req) => {
  const body = await req.json()
  return json(body, 201)
}

export const DELETE: RouteHandler = async (ctx) => null  // 204
```

La firma es `(ctx, req)`:
- `ctx.params` — params de la ruta
- `ctx.set / ctx.get` — estado compartido con el middleware
- `req` — `Request` nativo

Métodos disponibles: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`

## Hooks de contexto

Cuando usas `createHandler`, puedes acceder al request y al contexto de la ruta desde cualquier función del call stack sin pasarlos explícitamente. Importa desde `@devlusoft/devix/server`:

```ts
import { createHandler, json } from '@devlusoft/devix'
import { useRequest, useCtx, useParams } from '@devlusoft/devix/server'

async function getSession() {
  const req = useRequest()
  return verifyToken(req.headers.get('Authorization') ?? '')
}

export const GET = createHandler(async () => {
  const session = await getSession()
  if (!session) return json({ error: 'Unauthorized' }, 401)
  return json({ user: session.user })
})
```

| Hook | Retorna |
|---|---|
| `useRequest()` | `Request` — el request nativo |
| `useCtx()` | `RouteContext` — ctx con params y estado |
| `useParams()` | `Record<string, string>` — params de la ruta |

Los hooks lanzan un error si se llaman fuera de un handler activo.

## $fetch

`$fetch` tiene tipado de extremo a extremo: infiere el body esperado y el tipo de la respuesta a partir del `createHandler` de la ruta destino.

```ts
// En el cliente
import { $fetch } from '@devlusoft/devix'

// TypeScript exige el body correcto y tipea el resultado
const res = await $fetch('/api/auth/login', {
  method: 'POST',
  body: { email: 'user@example.com', password: '1234' },
})
// res tiene el tipo inferido del retorno del handler
```

Si el body enviado no coincide con el tipo esperado, TypeScript lo detecta en tiempo de compilación. En runtime, si el parsing falla (JSON malformado) o el handler lanza, devix retorna automáticamente un `500`.

Cuando el servidor responde con un status no-2xx, `$fetch` lanza `FetchError`:

```ts
import { $fetch, FetchError } from '@devlusoft/devix'

try {
  const res = await $fetch('/api/auth/login', {
    method: 'POST',
    body: { email: 'user@example.com', password: '1234' },
  })
} catch (err) {
  if (err instanceof FetchError) {
    console.error(err.status, err.body)  // ej. 401, { error: 'Credenciales inválidas' }
  }
}
```

`FetchError` expone: `status`, `statusText`, `response` (la `Response` original) y `body` (parseado si era JSON).

## Tipos de retorno

| Retorno | Resultado |
|---|---|
| Objeto o array | `200` con `Content-Type: application/json` |
| `json(data, status)` | JSON con status personalizado |
| `text(body, status)` | `text/plain` |
| `redirect(url, status)` | Redirección (302 por defecto) |
| `new Response(...)` | Control total |
| `null` / `void` | `204 No Content` |

## Cookies

```ts
import { getCookie, setCookie, deleteCookie, json, type RouteHandler } from '@devlusoft/devix'

export const POST: RouteHandler = async (ctx, req) => {
  const { email, password } = await req.json()
  const token = await createSession(email, password)
  if (!token) return json({ error: 'Credenciales inválidas' }, 401)

  const res = json({ ok: true })
  setCookie(res.headers, 'session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 7,  // 7 días
  })
  return res
}

export const DELETE: RouteHandler = async (ctx, req) => {
  const res = json({ ok: true })
  deleteCookie(res.headers, 'session')
  return res
}
```

`getCookie(req, name)` lee una cookie del request. `setCookie(headers, name, value, options)` y `deleteCookie(headers, name)` escriben en los headers de la respuesta.

## Middleware

`app/api/middleware.ts` corre antes de todos los handlers del mismo directorio y subdirectorios. Retorna `Response` para cortar, `null` para continuar:

```ts
import { getCookie, type MiddlewareModule } from '@devlusoft/devix'

export const middleware: MiddlewareModule['middleware'] = async (ctx, req) => {
  const token = getCookie(req, 'session')
  if (!token) return new Response('Unauthorized', { status: 401 })
  ctx.set('user', await verifyToken(token))
  return null
}
```

```ts
export const GET: RouteHandler = async (ctx) => {
  const user = ctx.get<User>('user')
  return user
}
```

## Errores

Lanza `DevixError` para retornar cualquier status HTTP de forma controlada desde un route handler:

```ts
import { DevixError, type RouteHandler } from '@devlusoft/devix'

export const GET: RouteHandler = async (ctx) => {
  const post = await db.posts.find(ctx.params.id)
  if (!post) throw new DevixError(404, 'Post no encontrado')
  return post
}
```

Con `createHandler`, también puedes lanzar un `DevixError` manualmente:

```ts
import { createHandler, json, DevixError } from '@devlusoft/devix'

export const POST = createHandler(async (body: { email: string }) => {
  if (!body.email) throw new DevixError(400, 'email requerido')
  return json({ ok: true })
})
```

> **Nota:** `DevixError` es para route handlers API. En loaders de página usa `return error(statusCode, message)` — ver [Carga de datos](./data-loading.md#errores).

Los errores inesperados devuelven `500` automáticamente.

## Nota sobre SSG

Las rutas API requieren servidor. No están disponibles con `output: 'static'`.
