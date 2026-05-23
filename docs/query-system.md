# Query System

El query system de devix permite registrar **queries nombradas** con deduplicación automática por request (server-side) y caché en el cliente. Sin necesidad de TanStack Query, React Query, o librerías externas.

## Registro

```ts
import { query } from '@devlusoft/devix'

export const getPost = query(async (id: string) => {
  return db.posts.find(id)
}, 'getPost')
```

El primer argumento es la función de fetch. El segundo es el nombre único de la query.

## Uso en loader

```ts
import { getPost } from '~/queries/posts'
import type { LoaderContext } from '@devlusoft/devix'

export async function loader({ params }: LoaderContext<{ slug: string }>) {
  const post = await getPost(params.slug)
  return { post }
}
```

## Cómo funciona

### Server-side

Cada request SSR crea un `QueryCache` propio mediante `AsyncLocalStorage`. Si dos loaders (o un loader y un layout) llaman a la misma query con los mismos argumentos, la segunda llamada **no ejecuta la función** — espera la Promise ya en curso.

```ts
// layout.tsx
export async function loader({ params }: LoaderContext) {
  const post = await getPost(params.slug)  // inicia fetch
  return { post: post.title }
}

// page.tsx — mismo request
export async function loader({ params }: LoaderContext) {
  const post = await getPost(params.slug)  // reuse: misma Promise
  return { post }
}
```

### Client-side

Los resultados de queries resueltas durante SSR se serializan en `window.__DEVIX_QUERIES__` e hidratan el caché cliente en bootstrap. Queries no cacheadas viajan por `POST /_devix/query` RPC.

```
[Hidratación]  → caché cliente con datos inline del SSR
[Falta en caché] → POST /_devix/query { name: 'getPost', args: ['123'] }
```

### Sin hydration

En el cliente, si la query no está en caché, hace un fetch RPC al servidor. El endpoint `/_devix/query` busca la query registrada, la ejecuta con los args, y retorna el resultado serializado.

## API

```ts
query<T, A extends unknown[]>(fn: (...args: A) => Promise<T>, name: string): (...args: A) => Promise<T>
```

| Parámetro | Descripción |
|---|---|
| `fn` | Función async que ejecuta la query |
| `name` | Nombre único para deduplicación y RPC |
| retorno | Wrapper con la misma firma que `fn` |

El wrapper chequea caché antes de ejecutar. En server usa el `QueryCache` del request activo. En cliente usa el caché hidratado + RPC.

## Server-side cache scope

Cada request tiene su propio `QueryCache`. No hay fuga de datos entre requests. Se implementa con `AsyncLocalStorage`:

```
Request A → QueryCache A → getPost('123') → fetch
                               getPost('123') → reuse
Request B → QueryCache B → getPost('123') → fetch (independiente)
```
