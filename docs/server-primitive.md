# `$server` — proxy a backends remotos

`$server` te deja llamar a backends remotos (tu API en Go/Rails/etc., microservicios internos) **directamente desde queries, loaders, handlers y componentes** sin tener que escribir un handler proxy en `app/api/` para cada endpoint.

```ts
// devix.config.ts
import { defineConfig } from '@devlusoft/devix/config'
import { getCookie } from '@devlusoft/devix'

export default defineConfig({
  server: {
    api: {
      url: process.env.API_URL!,                              // 'http://localhost:8080'
      prepare: ({ request, headers }) => {
        const sid = getCookie(request, 'sid')
        if (sid) headers.set('Authorization', `Bearer ${sid}`)
      },
      allowedPaths: ['/v1/**'],
    },
  },
})
```

```ts
// Loader o guard — $server viene del ctx, bound al request del usuario
export async function loader({ $server, params }: LoaderContext) {
  return await $server.api.get<Post>(`/v1/posts/${params.id}`)
}

// Handler API
export const POST = createHandler(async (body: CreatePostInput, ctx) => {
  return await ctx.$server.api.post<Post>('/v1/posts', body)
})

// Componente cliente — $server se importa
import { $server } from '@devlusoft/devix'

function ProfileButton() {
  const onClick = async () => {
    const me = await $server.api.get<User>('/v1/me')
    console.log(me)
  }
  return <button onClick={onClick}>Cargar</button>
}
```

---

## ⚠️ Cuándo usar `$server` y cuándo NO

**Usa `$server` cuando** el backend valida la autorización del usuario:
- Tu API propia con sesiones, JWT, OAuth, etc. — el backend rechaza requests sin auth válido
- Microservicios internos que validan el token que les pasas
- Cualquier upstream donde la autoridad del request **es la sesión del usuario**, no una key del server

`$server` **reenvía credenciales del usuario al backend**. Si el usuario no está autenticado, el backend devuelve 401 y el cliente lo recibe. El proxy es solo un cable.

**NO uses `$server` con APIs de terceros que requieran una API key del servidor** (Stripe, SendGrid, OpenAI, Twilio, etc.). Eso expondría esa key — cualquier visitante del sitio podría operar como si fuera tu app.

Para integraciones con terceros, escribe un handler explícito en `app/api/` con autorización propia:

```ts
// app/api/billing/customers.ts
import { createHandler, error } from '@devlusoft/devix'
import { stripe } from '~/lib/stripe'

export const POST = createHandler(async (body: CreateCustomerInput, ctx) => {
  const session = await getSession(ctx.request)
  if (!session) return error(401, 'No autenticado')
  if (!session.user.canManageBilling) return error(403, 'Sin permiso')

  return await stripe.customers.create({ ...body, metadata: { userId: session.user.id } })
})
```

Aquí tú validas explícitamente quién y qué, antes de tocar Stripe.

---

## Configuración

### `url` (requerido)

URL base del backend. Las paths del namespace se anteponen a esta URL.

```ts
api: {
  url: process.env.API_URL!,   // 'https://api.example.com'
}
```

### `prepare` (opcional)

Hook que corre antes de cada request. Recibe `{ request, headers, url }`:

- `request` — `Request` del cliente (server-side: el request del loader/handler)
- `headers` — `Headers` mutables que se enviarán al backend
- `url` — `URL` mutable de destino (puedes reescribir path)

Retorna `void` para continuar; retorna `Response` para cortar.

```ts
prepare: ({ request, headers, url }) => {
  // Auth pass-through
  const sid = getCookie(request, 'sid')
  if (sid) headers.set('Authorization', `Bearer ${sid}`)

  // Tracing
  headers.set('X-Request-Id', crypto.randomUUID())

  // Multi-tenancy
  const tenant = getTenantFromHost(request)
  headers.set('X-Tenant-Id', tenant)

  // Rewriting
  if (url.pathname.startsWith('/v1/legacy/')) {
    url.pathname = url.pathname.replace('/v1/legacy/', '/v2/')
  }

  // Bloquear
  if (isRateLimited(request)) {
    return new Response(JSON.stringify({ statusCode: 429, message: 'Too many' }), { status: 429 })
  }
}
```

`prepare` puede ser async — útil para refresh de tokens, lookup en cache, etc.

### `allowedPaths` (recomendado)

Lista de paths permitidos (globs). **Sin esto, el proxy responde 403 a todo** (deny-all por defecto). Defense in depth.

```ts
allowedPaths: ['/v1/**', '/v2/users/**']
```

Sintaxis:
- `**` — cualquier subpath incluido `/`
- `*` — un segmento sin `/`
- `:param` — un segmento

### `deniedPaths` (opcional)

Lista evaluada **después** de `allowedPaths`. Útil para excluir subpaths específicos:

```ts
allowedPaths: ['/v1/**'],
deniedPaths: ['/v1/admin/internal/**'],
```

---

## Tipado

`$server` no infiere tipos del backend remoto — vive fuera del repo y no hay forma honesta de descubrir su shape sin un contrato externo. El tipo se declara en cada call site con un generic:

```ts
import type { User, Post } from '~/models'

const me = await $server.api.get<User>('/v1/me')
const post = await $server.api.get<Post>('/v1/posts/123')

const input: { title: string; content: string } = { title: 'Hola', content: 'mundo' }
const created = await $server.api.post<Post>('/v1/posts', input)
```

Si no pasas el generic, el retorno es `unknown`:

```ts
const me = await $server.api.get('/v1/me')              // me: unknown
```

### ¿Por qué no un registry global?

Considerada y descartada. Un registry tipo `declare module BackendRoutes { ... }` te obliga a:

- Escribirlo a mano sin garantía de que coincida con la realidad del backend
- Mantenerlo sincronizado cada vez que el backend cambia
- Vivir en un archivo separado del call site

A cambio ganas autocompletado de paths — pero ese autocompletado puede mentir si el archivo no está actualizado. Cast en el call site es honesto: el contrato vive donde se usa, y si está mal lo ves al instante.

### Generación automática

Si tu backend expone OpenAPI/Swagger, usa [`openapi-typescript`](https://github.com/openapi-ts/openapi-typescript) para generar los tipos:

```bash
npx openapi-typescript http://localhost:8080/openapi.json -o ./types/backend.ts
```

Luego importas y casteas:

```ts
import type { paths } from './types/backend'

type User = paths['/v1/me']['get']['responses']['200']['content']['application/json']

const me = await $server.api.get<User>('/v1/me')
```

Si querés un wrapper que extraiga response type automáticamente desde una path, podés definirte un helper local. devix no impone una forma.

---

## Múltiples backends

Declara namespaces para cada backend remoto:

```ts
server: {
  api: {
    url: process.env.API_URL!,
    prepare: ({ request, headers }) => {
      const sid = getCookie(request, 'sid')
      if (sid) headers.set('Authorization', `Bearer ${sid}`)
    },
    allowedPaths: ['/v1/**'],
  },
  analytics: {
    url: process.env.ANALYTICS_URL!,
    prepare: ({ headers }) => {
      headers.set('Authorization', `Bearer ${process.env.ANALYTICS_TOKEN}`)
    },
    allowedPaths: ['/track', '/identify'],
  },
}
```

```ts
await $server.api.get('/v1/me')
await $server.analytics.post('/track', { event: 'page_view' })
```

---

## Errores

Las respuestas no-2xx del backend lanzan `FetchError` con el shape `ErrorBody`:

```ts
try {
  await $server.api.get('/v1/posts/999')
} catch (err) {
  if (err instanceof FetchError) {
    err.status      // 404
    err.message     // mensaje del backend
    err.code        // código machine-readable si el backend lo manda
    err.body        // body parseado completo
  }
}
```

Errores del proxy mismo (path no permitido, prepare fallido, backend inalcanzable) también devuelven el shape `ErrorBody`:

| Status | Code                  | Cuándo                         |
|--------|-----------------------|--------------------------------|
| 403    | `PATH_NOT_ALLOWED`    | Path no matchea `allowedPaths` |
| 403    | `PATH_DENIED`         | Path matchea `deniedPaths`     |
| 404    | `BACKEND_NOT_FOUND`   | Namespace no configurado       |
| 500    | `PREPARE_ERROR`       | `prepare` lanzó una excepción  |
| 502    | `BACKEND_UNREACHABLE` | Fetch al backend falló         |

---

## Internals

**Cliente → backend** pasa por el proxy interno `/_devix/server/<namespace>/<path>`:

```
[Browser] → GET /_devix/server/api/v1/me
              ↓ valida allowedPaths/deniedPaths
              ↓ ejecuta prepare con el Request del usuario
              ↓ fetch a {url}/v1/me con headers preparados
              ← stream response del backend
```

**Server-side (loader/handler) → backend** hace fetch directo al backend, **sin doble hop**:

```
[Loader] → ctx.$server.api.get('/v1/me')
              ↓ valida allowedPaths/deniedPaths
              ↓ ejecuta prepare con el Request del loader (mismo Request que recibió la ruta)
              ↓ fetch a {url}/v1/me con headers preparados
              ← response parseada
```

La misma función `prepare` corre en ambos casos con el mismo `Request` — comportamiento consistente.

---

## Versionado

`$server` se introdujo en v0.5. La API del cliente y la del bound (vía ctx) están alineadas — mismo objeto, mismos métodos, mismo tipado. Cambios incompatibles serán anunciados en el changelog.
