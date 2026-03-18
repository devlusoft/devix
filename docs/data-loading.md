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

```ts
import { DevixError } from '@devlusoft/devix'

export async function loader({ params }: LoaderContext) {
  const post = await db.posts.find(params.id)
  if (!post) throw new DevixError(404, 'Post no encontrado')
  return post
}
```

Un error no controlado devuelve 500.
