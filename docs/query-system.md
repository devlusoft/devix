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

## Cómo funciona

### Server-side

Cada request SSR crea un `QueryCache` propio mediante `AsyncLocalStorage`. Si dos componentes o páginas llaman a la misma query con los mismos argumentos durante el mismo SSR, la segunda llamada **no ejecuta la función** — espera la Promise ya en curso.

```ts
await getPost('123')  // inicia fetch
await getPost('123')  // reuse: misma Promise
```

### Client-side

Los resultados de queries resueltas durante SSR se serializan en `window.__DEVIX_QUERIES__` e hidratan el caché cliente en bootstrap. Queries no cacheadas viajan por `POST /_devix/query` RPC.

```
[Hidratación]  → caché cliente con datos inline del SSR
[Falta en caché] → POST /_devix/query { name: 'getPost', args: ['123'] }
```

### Sin hydration

En el cliente, si la query no está en caché, hace un fetch RPC al servidor. El endpoint `/_devix/query` busca la query registrada, la ejecuta con los args, y retorna el resultado serializado.

## Seguridad

El cuerpo de `query(fn, name)` **nunca llega al bundle cliente**. devix detecta automáticamente la llamada en el build de cliente y reemplaza `fn` por un stub que lanza error:

```ts
// Esto NUNCA toca el bundle cliente:
export const getMe = query(async () => {
  const token = getCookie('session')
  return db.users.findByToken(token)
}, 'me')

// El cliente recibe:
export const getMe = query(async (...$a) => {
  throw new Error("server-only code")
}, 'me')
```

Los imports que solo usaba `fn` se tree-shakean automáticamente. Esto funciona en cualquier archivo — no requiere convención de directorios.

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

## Cookies dentro de queries

Dentro de una query puedes leer cookies del request activo sin pasar parámetros:

```ts
export const getMe = query(async () => {
  const token = getCookie('session')
  if (!token) return null
  return verifyToken(token)
}, 'me')
```

Esto funciona porque el handler `/_devix/query` mantiene un `AsyncLocalStorage` con el `Request` original. Ver [Cookies](./cookies.md) para la API completa.

## Server-side cache scope

Cada request tiene su propio `QueryCache`. No hay fuga de datos entre requests. Se implementa con `AsyncLocalStorage`:

```
Request A → QueryCache A → getPost('123') → fetch
                               getPost('123') → reuse
Request B → QueryCache B → getPost('123') → fetch (independiente)
```
