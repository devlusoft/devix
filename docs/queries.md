# Queries

`query(fn, name)` define una unidad de datos reutilizable que se ejecuta en el servidor durante el render y se hidrata al cliente sin doble roundtrip. Sustituye a `loader()` para data fetching dentro de componentes.

## API

```ts
import { query } from '@devlusoft/devix'

export const getPost = query(
  async (id: string) => {
    return db.posts.findById(id)
  },
  'get-post',
)
```

- `fn` — la función que produce los datos. Se ejecuta **solo en el servidor**. Puede ser sync o async.
- `name` — string identificador. Es parte del API público: el cache key se deriva de él más los argumentos. Si lo renombrás, el cache de clientes hidratados queda inconsistente.

## Leer datos en un componente

```tsx
import { useQuery } from '@devlusoft/devix'
import { getPost } from '~/queries/posts'

export default function Post({ params }: { params: { slug: string } }) {
  const post = useQuery(() => getPost(params.slug))
  return <h1>{post.title}</h1>
}
```

`useQuery` recibe una función que retorna la promise (o valor sync) de la query. Internamente usa `React.use()` para unwrap con Suspense nativo de React 19.

### Importante: memoizá el callback

`useQuery` cachea por referencia de la función. Si pasás un arrow inline nuevo cada render, se invalida el cache y el componente re-suspende. Tres formas de evitarlo:

```tsx
// 1. Extraer fuera del componente (recomendado para queries sin args)
const post = useQuery(() => getPost('default-id'))

// 2. useCallback si necesitás args
const Post = ({ id }: { id: string }) => {
  const cb = useCallback(() => getPost(id), [id])
  const post = useQuery(cb)
  return <h1>{post.title}</h1>
}

// 3. Pasar args a través de useRef o useMemo
```

## Suspense

`useQuery` tira a Suspense cuando la query no está en el cache. Envolvé en `<Suspense>` los componentes que la usan:

```tsx
import { Suspense } from 'react'

export default function Page() {
  return (
    <Suspense fallback={<p>Cargando…</p>}>
      <Post slug="hello" />
    </Suspense>
  )
}
```

En SSR, el render espera a que las queries dentro del Suspense resuelvan antes de emitir el HTML.

## Hidratación sin doble roundtrip

Cuando el server ejecuta la query, el resultado se serializa en el HTML en un script inline:

```html
<script>
  window.__DEVIX_QUERIES__ = {
    "devix:query:get-post:[\"abc\"]": { "id": "abc", "title": "..." }
  };
</script>
```

El cliente lee este mapa antes de llamar a la query. Si el cache hit existe, devuelve el valor sincrónicamente — sin fetch. Si no (ej: navegación client-side a una ruta que pide datos nuevos), cae al RPC `POST /_devix/server`.

## Cache key

`` `devix:query:${name}:${JSON.stringify(args)}` ``

- Mismo nombre + mismos args → mismo cache hit.
- Args no-JSON-safe (funciones, Symbols, ciclos) caen al `String(args)` fallback. **No usar args no-serializables si esperás cache hit**.

## Invalidar queries

Después de un `action()` que muta datos (create, update, delete), las queries en pantalla no se actualizan solas. Llamá `invalidateQueries()` para forzar re-fetch:

```tsx
import { invalidateQueries } from '@devlusoft/devix'

async function onDelete(id: string) {
  await deleteTask(id)
  invalidateQueries()
  revalidate()
}
```

`useRevalidate()` también invoca `invalidateQueries()` internamente, así que basta con `revalidate()` después de mutar. `invalidateQueries()` explícito solo si querés ser claro sobre el flujo.

Por ahora invalida todas las queries. Filtrar por nombre es follow-up.

## RPC fallback

Cuando el cliente no encuentra el valor en `window.__DEVIX_QUERIES__`, hace `POST /_devix/server` con header `X-Server-Id: query:<name>`. El server lee el fn del registry, ejecuta, devuelve seroval/turbo-stream con el resultado.

## Restricciones y gotchas

- **Args JSON-serializables.** Funciones, Symbols, y referencias circulares en args rompen el cache key. Documentalo en tu código.
- **Resultado puede ser `undefined`.** Si la query retorna `undefined`, el server serializa como `null` en el JSON para preservar la key. El cliente deserializa `null` → `undefined`. Si tu UI distingue `null` vs `undefined`, tenelo en cuenta.
- **Errores no se hidratan.** Si la query rechaza en server, el cliente **no** sabe del error — el cache está vacío para esa key. Hace fetch al server, que puede volver a rechazar. Manejá errores con `<ErrorBoundary>` o tu propio patrón.
- **`query()` no es revalidable por nombre.** No hay `revalidate(name)` todavía. Si necesitás invalidar, hacé una nueva navegación o cambiá los args.
- **Tree-shaking.** El body de la query NO llega al bundle cliente. El AST transform de Vite reemplaza `query(fn, name)` por `clientQuery(name)` en client builds. Si importás el módulo de query desde un archivo del cliente sin pasar por el transform, el body puede filtrarse.

## Migración desde loader

| Antes (loader) | Ahora (query + useQuery) |
|---|---|
| `export async function loader({ params }) { ... }` | `export const getX = query(async (...) => ..., 'get-x')` |
| `function Page({ data }) { return <h1>{data.title}</h1> }` | `function Page() { const x = useQuery(() => getX(...)); return <h1>{x.title}</h1> }` |
| `useLoaderData<typeof loader>()` | `useQuery(() => getX(...))` (llamada directa) |
| Layout con data compartida | Query global en archivo aparte, llamada desde donde se necesite |
| Una por página/layout | Reusable entre páginas, layouts, otros queries, actions |
| Sin dedup | Deduplicada por `(name, args)` |
| Re-fetch en cada navegación | Cache cliente + RPC on-demand |

### Ejemplo completo de migración

Antes:
```tsx
// app/pages/posts/[slug].tsx
import type { PageProps, LoaderContext } from '@devlusoft/devix'

export async function loader({ params }: LoaderContext) {
  return db.posts.findBySlug(params.slug)
}

export default function Post({ data }: PageProps<typeof loader>) {
  return (
    <article>
      <h1>{data.title}</h1>
      <p>{data.body}</p>
      <Author userId={data.authorId} />
    </article>
  )
}

function Author({ userId }: { userId: string }) {
  const { author } = useLoaderData<{ author: string }>()
  return <span>{author.name}</span>
}
```

Después:
```ts
// app/queries/posts.ts
import { query } from '@devlusoft/devix'

export const getPost = query(
  async (slug: string) => db.posts.findBySlug(slug),
  'get-post',
)

export const getAuthor = query(
  async (userId: string) => db.users.findById(userId),
  'get-author',
)
```

```tsx
// app/pages/posts/[slug].tsx
import { useQuery } from '@devlusoft/devix'
import { getPost, getAuthor } from '~/queries/posts'

export default function Post({ params }: { params: { slug: string } }) {
  const post = useQuery(() => getPost(params.slug))
  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.body}</p>
      <Author userId={post.authorId} />
    </article>
  )
}

function Author({ userId }: { userId: string }) {
  const author = useQuery(() => getAuthor(userId))
  return <span>{author.name}</span>
}
```

`Author` ya no depende del loader del padre — puede vivir en cualquier lado del árbol.