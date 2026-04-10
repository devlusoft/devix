# Carga de datos

## loader

Se ejecuta en el servidor antes del renderizado. El valor que retorna llega como `data` a la página:

```tsx
import type { PageProps, LoaderContext } from '@devlusoft/devix'

export async function loader({ params, request }: LoaderContext) {
  return db.posts.findBySlug(params.slug)
}

export default function Post({ data }: PageProps<typeof loader>) {
  return <h1>{data.title}</h1>
}
```

## useLoaderData

Accede a los datos del loader desde cualquier componente en el árbol:

```tsx
import { useLoaderData } from '@devlusoft/devix'

function Author() {
  const { author } = useLoaderData<{ author: string }>()
  return <span>{author}</span>
}
```

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
import type { LoaderContextWithGuard, GuardFunction } from '@devlusoft/devix'

export const guard: GuardFunction = async ({ request }) => {
  const session = await getSession(request)
  if (!session) return '/login'
  return session  // ← se convierte en guardData
}

export async function loader({ params, guardData }: LoaderContextWithGuard<typeof guard>) {
  // guardData tiene el tipo inferido de lo que retorna guard
  return db.posts.findByUser(guardData.userId, params.slug)
}
```

`LoaderContextWithGuard<TGuard>` extiende `LoaderContext` añadiendo `guardData` con el tipo correcto inferido del guard.

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

devix detecta el `error()` y renderiza la página `error.tsx` correspondiente con el `statusCode` y `message` indicados. Un error lanzado sin usar `error()` devuelve 500.
