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

La firma del callback es `(body, ctx)`:

```ts
// app/api/auth/login.ts
import { createHandler, json, error } from '@devlusoft/devix'

export const POST = createHandler(async (body: { email: string; password: string }, ctx) => {
  const ua = ctx.request.headers.get('User-Agent')
  const token = await createSession(body.email, body.password, ua)
  if (!token) return error(401, 'Credenciales inválidas', { code: 'INVALID_CREDENTIALS' })
  return json({ ok: true })
})

export const GET = createHandler(async () => {
  return json({ status: 'ok' })
})
```

### Body — primer argumento

devix parsea el body automáticamente según el `Content-Type` del request:

- `application/json` → objeto JS
- `multipart/form-data` / `application/x-www-form-urlencoded` → `FormData`
- cualquier otro → `string`

El tipo del primer parámetro **define** el tipo del body — no se pasa tipo genérico explícito.

### Ctx — segundo argumento

`ctx: RouteContext` expone todo lo que necesitas del request en una sola estructura:

| Prop                  | Tipo                     | Descripción                                                    |
|-----------------------|--------------------------|----------------------------------------------------------------|
| `ctx.request`         | `Request`                | El `Request` nativo                                            |
| `ctx.url`             | `URL`                    | URL ya parseada — usa `ctx.url.searchParams` para query string |
| `ctx.params`          | `Record<string, string>` | Params de la ruta (`/users/[id]`)                              |
| `ctx.get<T>(key)`     | `T \| undefined`         | Lee state heredado del middleware                              |
| `ctx.set(key, value)` | `void`                   | Escribe state para handlers de más adentro                     |

### Casos típicos

```ts
// Sin body — el handler no declara args
export const GET = createHandler(async () => ({ status: 'ok' }))

// Con body tipado
export const POST = createHandler(async (body: { email: string }) => ...)

// Con body y ctx
export const POST = createHandler(async (body: Login, ctx) => {
  const user = ctx.get<User>('user')
})

// Solo ctx, sin body — útil para GET con query params
export const GET = createHandler(async (_body, ctx) => {
  const filter = ctx.url.searchParams.get('filter')
  return await db.posts.find({ filter })
})
```

### Validación con Standard Schema

`createHandler` acepta como primer argumento opcional un schema que implemente [Standard Schema](https://standardschema.dev) — Zod 3.24+, Valibot, ArkType, Effect Schema y otros. devix valida el body automáticamente antes de llamar al handler.

```ts
import { z } from 'zod'
import { createHandler, json } from '@devlusoft/devix'

const Input = z.object({
  email: z.email(),
  password: z.string().min(8),
})

export const POST = createHandler(Input, async (body, ctx) => {
  // body: { email: string; password: string } — ya validado, tipado al output del schema
  const token = await createSession(body.email, body.password)
  return json({ ok: true })
})
```

Si la validación falla, devix devuelve `400` automáticamente con el shape `ErrorBody`:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "data": {
    "issues": [
      { "message": "Invalid email", "path": ["email"] },
      { "message": "String must contain at least 8 character(s)", "path": ["password"] }
    ]
  }
}
```

El cliente puede ramificar por `err.code === 'VALIDATION_ERROR'` y leer `err.body.data.issues` para mostrar errores por campo.

> Funciona con **cualquier validador** que implemente el contrato Standard Schema — devix no depende de Zod ni de ninguna librería. Si tu validador soporta transformaciones (ej. `z.coerce.number()`), el handler recibe el output ya transformado.

## RouteHandler (handler clásico)

Para casos donde necesitas control total del response sin tipado E2E:

```ts
import { json, type RouteHandler } from '@devlusoft/devix'

export const GET: RouteHandler = async (ctx) => {
  return { hello: ctx.params.id }
}

export const POST: RouteHandler = async (ctx) => {
  const body = await ctx.request.json()
  return json(body, 201)
}

export const DELETE: RouteHandler = async () => null  // 204
```

La firma es `(ctx) =>`. Todo lo del request vive en `ctx`:
- `ctx.request` — `Request` nativo
- `ctx.url` — `URL` parseada (incluye `searchParams`)
- `ctx.params` — params de la ruta
- `ctx.set / ctx.get` — estado compartido con el middleware
- `ctx.$server` — clientes para backends remotos

Métodos disponibles: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`

## Hooks de contexto (deprecado)

> ⚠️ **Deprecado desde v0.5.** Usa el `ctx` que recibe tu handler como segundo argumento. Los hooks `useRequest`/`useCtx`/`useParams` serán eliminados en v0.6.

`@devlusoft/devix/server` exporta tres hooks que leen del `AsyncLocalStorage` activo durante un request:

```ts
// Forma vieja
import { useRequest } from '@devlusoft/devix/server'

async function getSession() {
  const req = useRequest()   // hook que solo funciona dentro de un handler activo
  return verifyToken(req.headers.get('Authorization') ?? '')
}

// Forma nueva — pasa lo que necesites
async function getSession(req: Request) {
  return verifyToken(req.headers.get('Authorization') ?? '')
}

export const GET = createHandler(async (_body, ctx) => {
  const session = await getSession(ctx.request)
  if (!session) return error(401, 'No autenticado')
  return { user: session.user }
})
```

La forma nueva es más testeable (pasas un mock como argumento), más explícita (sabes de dónde viene el dato), y no depende del estado mágico de `AsyncLocalStorage`.

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
    console.error(err.message)   // mensaje del servidor — ej. "Credenciales inválidas"
    console.error(err.code)      // código machine-readable si lo hubo — ej. "INVALID_CREDENTIALS"
    console.error(err.status)    // 401
    console.error(err.body)      // body parseado (ErrorBody si es JSON)
  }
}
```

`FetchError` expone:

| Prop         | Descripción                                                                                               |
|--------------|-----------------------------------------------------------------------------------------------------------|
| `message`    | Mensaje del error. Si el body del servidor tiene `.message`, lo usa; si no, `HTTP {status}: {statusText}` |
| `code`       | Código machine-readable extraído del body si existe                                                       |
| `status`     | Status HTTP                                                                                               |
| `statusText` | Status text HTTP                                                                                          |
| `body`       | Body parseado del response (tipado `ErrorBody` cuando el servidor usa `error()` o `DevixError`)           |
| `response`   | La `Response` original                                                                                    |

## Tipos de retorno

| Retorno                 | Resultado                                  |
|-------------------------|--------------------------------------------|
| Objeto o array          | `200` con `Content-Type: application/json` |
| `json(data, status)`    | JSON con status personalizado              |
| `text(body, status)`    | `text/plain`                               |
| `redirect(url, status)` | Redirección (302 por defecto)              |
| `new Response(...)`     | Control total                              |
| `null` / `void`         | `204 No Content`                           |

## Cookies

En API routes **no hay `AsyncLocalStorage`**, así que siempre se usa el modo explícito (ver [Cookies](./cookies.md)):

```ts
import { getCookie, setCookie, deleteCookie, json, type RouteHandler } from '@devlusoft/devix'

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

export const DELETE: RouteHandler = async () => {
  const res = json({ ok: true })
  deleteCookie(res.headers, 'session')
  return res
}
```

| Función | Parámetros |
|---|---|
| `getCookie(request, name)` | Request nativo + nombre |
| `setCookie(headers, name, value, opts?)` | Headers de respuesta + nombre + valor + opciones |
| `deleteCookie(headers, name, opts?)` | Headers de respuesta + nombre |

## Middleware

`app/api/middleware.ts` corre antes de todos los handlers del mismo directorio y subdirectorios. Retorna `Response` para cortar, `null` para continuar:

```ts
import { getCookie, type MiddlewareModule } from '@devlusoft/devix'

export const middleware: MiddlewareModule['middleware'] = async (ctx) => {
  const token = getCookie(ctx.request, 'session')
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

Devix tiene **un solo shape** para errores que vienen de la API. Todos los errores emitidos por `error()` (return) o `DevixError` (throw) se serializan al mismo body:

```ts
interface ErrorBody {
    statusCode: number
    message: string
    code?: string   // opcional, código machine-readable
    data?: unknown  // opcional, datos estructurados (ej. errores de validación por campo)
}
```

### `error()` — retornar (recomendado)

```ts
import { createHandler, error } from '@devlusoft/devix'

export const GET = createHandler(async () => {
  const post = await db.posts.find('123')
  if (!post) return error(404, 'Post no encontrado', { code: 'POST_NOT_FOUND' })
  return post
})
```

`error()` es la misma función que se usa en loaders/guards. Funciona en ambos contextos. Más simple y legible que un throw.

### `DevixError` — lanzar (cuando `return` no es práctico)

Cuando estás 4 niveles abajo del handler (helpers, dependencias) y propagar el `return` sería ruido:

```ts
import { DevixError } from '@devlusoft/devix'

async function requireUser(req: Request) {
  const user = await getUser(req)
  if (!user) throw new DevixError(401, 'No autenticado', { code: 'UNAUTHENTICATED' })
  return user
}
```

`DevixError` y `error()` producen exactamente el mismo body en la respuesta — usa el que se lea mejor en cada caso.

### Errores no controlados

Cualquier error que no sea `DevixError` ni `error()` se reporta como `500` con el shape estandarizado:

```json
{ "statusCode": 500, "message": "Internal Server Error" }
```

## Nota sobre SSG

Las rutas API requieren servidor. No están disponibles con `output: 'static'`.
