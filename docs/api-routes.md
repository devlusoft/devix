# Rutas API

Los archivos dentro de `app/api/` se convierten en endpoints HTTP.

## Estructura

| Archivo                  | Endpoint         |
|--------------------------|------------------|
| `app/api/health.ts`      | `/api/health`    |
| `app/api/posts/index.ts` | `/api/posts`     |
| `app/api/posts/[id].ts`  | `/api/posts/:id` |

## Handlers

Exporta una constante por método HTTP:

```ts
// app/api/posts/[id].ts
import type { RouteHandler } from '@devlusoft/devix'

export const GET: RouteHandler = async (ctx) => {
  const post = await db.posts.find(ctx.params.id)
  if (!post) return json({ error: 'Not Found' }, 404)
  return post  // auto JSON 200
}

export const DELETE: RouteHandler = async (ctx) => {
  await db.posts.delete(ctx.params.id)
  return null  // 204 No Content
}
```

La firma es `(ctx, req)`:
- `ctx.params` — params de la ruta
- `ctx.set / ctx.get` — estado compartido con el middleware
- `req` — `Request` nativo

Métodos disponibles: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`

## Tipos de retorno

| Retorno | Resultado |
|---|---|
| Objeto o array | `200` con `Content-Type: application/json` |
| `json(data, status)` | JSON con status personalizado |
| `text(body, status)` | `text/plain` |
| `redirect(url, status)` | Redirección (302 por defecto) |
| `new Response(...)` | Control total |
| `null` | `204 No Content` |

```ts
import { json, text, redirect, type RouteHandler } from '@devlusoft/devix'

export const GET: RouteHandler = async (ctx) => {
  return { users: await db.users.all() }   // auto JSON
}

export const POST: RouteHandler = async (ctx, req) => {
  const body = await req.json()
  const user = await db.users.create(body)
  return json(user, 201)
}

export const DELETE: RouteHandler = async (ctx) => {
  await db.users.delete(ctx.params.id)
  return null
}
```

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

```ts
import { DevixError, type RouteHandler } from '@devlusoft/devix'

export const GET: RouteHandler = async (ctx) => {
  const post = await db.posts.find(ctx.params.id)
  if (!post) throw new DevixError(404, 'Post no encontrado')
  return post
}
```

`DevixError` acepta cualquier status HTTP. Los errores inesperados devuelven `500` automáticamente.

## Nota sobre SSG

Las rutas API requieren servidor. No están disponibles con `output: 'static'`.
