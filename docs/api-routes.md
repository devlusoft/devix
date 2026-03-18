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
  if (!post) return new Response('Not Found', { status: 404 })
  return Response.json(post)
}

export const DELETE: RouteHandler = async (ctx) => {
  await db.posts.delete(ctx.params.id)
  return new Response(null, { status: 204 })
}
```

La firma es `(ctx, req)`:
- `ctx.params` — params de la ruta
- `ctx.set / ctx.get` — estado compartido con el middleware
- `req` — `Request` nativo

Métodos disponibles: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`

## Body

```ts
export const POST: RouteHandler = async (ctx, req) => {
  const body = await req.json<{ title: string }>()
  const post = await db.posts.create(body)
  return Response.json(post, { status: 201 })
}
```

## Middleware

`app/api/middleware.ts` corre antes de todos los handlers del mismo directorio y subdirectorios. Retorna `Response` para cortar, `null` para continuar:

```ts
import type { MiddlewareModule } from '@devlusoft/devix'

export const middleware: MiddlewareModule['middleware'] = async (ctx, req) => {
  const token = req.headers.get('Authorization')
  if (!token) return new Response('Unauthorized', { status: 401 })
  ctx.set('user', await verifyToken(token))
  return null
}
```

```ts
export const GET: RouteHandler = async (ctx) => {
  const user = ctx.get<User>('user')
  return Response.json(user)
}
```

## Errores

```ts
import { DevixError } from '@devlusoft/devix'

export const GET: RouteHandler = async (ctx) => {
  const post = await db.posts.find(ctx.params.id)
  if (!post) throw new DevixError(404, 'Post no encontrado')
  return Response.json(post)
}
```

## Nota sobre SSG

Las rutas API requieren servidor. No están disponibles con `output: 'static'`.
