# Carga de datos

> ⚠️ **`loader()` y `useLoaderData()` están deprecated desde 0.9.0-alpha.2.** Migración: [`query()` + `useQuery()`](./queries.md).
>
> El sistema de loaders sigue funcionando pero no recibe mejoras. Las páginas nuevas deberían usar queries. Migración página por página, sin prisa.

## Quickstart con queries (recomendado)

```ts
// app/queries/posts.ts
import { query } from '@devlusoft/devix'

export const getPost = query(
  async (slug: string) => db.posts.findBySlug(slug),
  'get-post',
)
```

```tsx
// app/pages/posts/[slug].tsx
import { useQuery } from '@devlusoft/devix'
import { getPost } from '~/queries/posts'

export default function Post({ params }: { params: { slug: string } }) {
  const post = useQuery(() => getPost(params.slug))
  return <h1>{post.title}</h1>
}
```

Ver [`docs/queries.md`](./queries.md) para la guía completa: hidratación sin doble roundtrip, cache key, RPC fallback, Suspense, migración desde loaders.

## Legacy: loader + useLoaderData

Siguen funcionando. No hay breaking change.

```tsx
// app/pages/blog/[slug].tsx
import type { PageProps, LoaderContext } from '@devlusoft/devix'

export async function loader({ params, request }: LoaderContext) {
  return db.posts.findBySlug(params.slug)
}

export default function Post({ data }: PageProps<typeof loader>) {
  return <h1>{data.title}</h1>
}
```

```tsx
import { useLoaderData } from '@devlusoft/devix'

function Author() {
  const { author } = useLoaderData<{ author: string }>()
  return <span>{author}</span>
}
```

### Por qué migrar

| | loader | query |
|---|---|---|
| Definición | Una por página/layout | Función reusable, vive en cualquier archivo |
| Llamable desde otros server fns | No | Sí (un query puede llamar a otro) |
| Cache key | Por ruta | Por `(name, args)` |
| Reactividad | Snapshot por render | Signal Solid-style + Suspense |
| Streaming de hidratación | Custom (deferred values) | Nativo via React 19 Suspense |
| Tree-shaking | Disciplina de imports | AST transform en Vite |
| Doc | `docs/data-loading.md` (este archivo) | [`docs/queries.md`](./queries.md) |

### Cómo migrar

1. Definí tus queries en `app/queries/<entidad>.ts` con `query(fn, name)`.
2. En la página, reemplazá `function Page({ data })` por `function Page()` + `useQuery(() => getThing(...))` adentro.
3. Borrá el `loader` export. Borrá el tipo `LoaderContext` y `PageProps<typeof loader>`.
4. Reemplazá `useLoaderData()` por `useQuery(() => getThing(...))` en componentes hijos.
5. Verificá que el HTML contiene el script `window.__DEVIX_QUERIES__` con los datos esperados.

El framework soporta ambos sistemas en paralelo. La migración es página por página.

## useParams

```tsx
import { useParams } from '@devlusoft/devix'

const { slug } = useParams<{ slug: string }>()
```

## guard

Corre antes del loader. Retorna una ruta para redirigir, `null` para continuar:

```ts
export async function guard({ request }: LoaderContext) {
  const session = await getSession(request)
  if (!session) return '/login'
  return null
}
```

### guardData

Si `guard` retorna un **objeto** (en lugar de un string o `null`), ese valor queda disponible en el loader como `guardData`. Útil para pasar datos de autenticación sin volver a consultar:

```ts
import type { LoaderContext, LoaderContextWithGuard } from '@devlusoft/devix'

export async function guard({ request }: LoaderContext) {
  const session = await getSession(request)
  if (!session) return '/login'
  return session  // ← se convierte en guardData
}

export async function loader({ params, guardData }: LoaderContextWithGuard<typeof guard>) {
  // guardData tiene el tipo inferido de lo que retorna guard
  return db.posts.findByUser(guardData.userId, params.slug)
}
```

`LoaderContextWithGuard<TGuard>` extiende `LoaderContext` añadiendo `guardData` con el tipo concreto inferido del guard.

> ⚠️ **No anotes el guard con `GuardFunction`** si quieres inferencia de `guardData`. El tipo `GuardFunction` declara el retorno como `object` genérico, lo que aplana el tipo concreto que devuelves y rompe la inferencia en `LoaderContextWithGuard<typeof guard>`. Deja que TypeScript infiera el tipo del retorno por sí solo — anota únicamente `ctx: LoaderContext` (o ni eso). `GuardFunction` queda como tipo público para casos de helpers reutilizables donde el tipo concreto no importa, pero no es la forma recomendada en uso cotidiano.

### useGuardData — leer guardData sin loader

Cuando el guard retorna datos y no necesitas un `loader` (común para sesión de usuario), puedes leer el `guardData` directamente desde cualquier componente con `useGuardData`:

```tsx
import { useGuardData } from '@devlusoft/devix'

// app/pages/dashboard/layout.tsx
export async function guard({ request }: LoaderContext) {
  const session = await getSession(request)
  if (!session) return '/login'
  return session
}

// app/pages/dashboard/index.tsx — sin loader
export default function Dashboard() {
  const session = useGuardData<typeof guard>()
  return <h1>Hola, {session.user.name}</h1>
}
```

`useGuardData()` devuelve el último valor que retornó algún guard de la ruta (layouts → page, en orden). Pasar `typeof guard` como generic infiere el tipo concreto.

## Timeout

```ts
export default defineConfig({
  loaderTimeout: '5s',  // ms | s | m | h
})
```

Por defecto `10s`. Si el loader supera el tiempo, la petición falla de forma controlada.

## Navegación en el cliente

Al navegar con `<Link>` o `useNavigate`, devix obtiene los datos vía `/_data` y re-renderiza — sin recarga de página.

## Errores

Usa `error()` para retornar un error HTTP controlado desde un loader o guard. **Retorna** el valor — no lo lances:

```ts
import { error } from '@devlusoft/devix'

export async function loader({ params }: LoaderContext) {
  const post = await db.posts.find(params.id)
  if (!post) return error(404, 'Post no encontrado')
  return post
}
```

devix detecta el `error()` y renderiza la página `error.tsx` correspondiente. Un error lanzado sin usar `error()` devuelve 500.

### Opciones: code y data

```ts
return error(404, 'Post no encontrado', {
  code: 'POST_NOT_FOUND',
  data: { postId: params.id },
})
```

- **`code`** — código machine-readable. Útil para que el cliente o `error.tsx` ramifiquen sin parsear strings.
- **`data`** — datos estructurados. Ej. validación por campo: `{ data: { fields: { email: 'Invalid format' } } }`.

Tu `error.tsx` recibe ambos como props:

```tsx
import type { ErrorProps } from '@devlusoft/devix'

export default function ErrorPage({ statusCode, message, code, data }: ErrorProps) {
  return (
    <div>
      <h1>{statusCode}</h1>
      <p>{message}</p>
      {code === 'POST_NOT_FOUND' && <Link href="/">Volver al inicio</Link>}
    </div>
  )
}
```

> El mismo `error()` funciona en handlers API y queries. Ver [API Routes — Errores](./api-routes.md#errores).