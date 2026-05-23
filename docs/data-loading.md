# Carga de datos

## loader

Se ejecuta en el servidor antes del renderizado. El valor que retorna llega como `data` a la página:

```tsx
import type { PageProps, LoaderContext } from '@devlusoft/devix'

export async function loader({ params, request }: LoaderContext) {
  return db.posts.findBySlug(params.slug)
}

export default function Post(props: PageProps<typeof loader>) {
  return <h1>{props.data.title}</h1>
}
```

## useLoaderData

Accede a los datos del loader desde cualquier componente en el árbol. Retorna una **signal** (se accede con `data()`, no `data`):

```tsx
import { useLoaderData } from '@devlusoft/devix'

function Author() {
  const data = useLoaderData<{ author: string }>()
  return <span>{data().author}</span>
}
```

## useParams

Retorna una signal con los params:

```tsx
import { useParams } from '@devlusoft/devix'

const params = useParams<{ slug: string }>()
return <span>{params().slug}</span>
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

Si `guard` retorna un **objeto**, ese valor queda disponible en el loader como `guardData`:

```ts
import type { LoaderContext, LoaderContextWithGuard } from '@devlusoft/devix'

export async function guard({ request }: LoaderContext) {
  const session = await getSession(request)
  if (!session) return '/login'
  return session
}

export async function loader({ params, guardData }: LoaderContextWithGuard<typeof guard>) {
  return db.posts.findByUser(guardData.userId, params.slug)
}
```

### useGuardData

Cuando el guard retorna datos y no necesitas un `loader`, puedes leer el `guardData` directamente desde cualquier componente. Retorna una **signal**:

```tsx
import { useGuardData } from '@devlusoft/devix'

export default function Dashboard() {
  const session = useGuardData<typeof guard>()
  return <h1>Hola, {session().user.name}</h1>
}
```

## Query system

Registra queries nombradas con deduplicación automática por request:

```ts
import { query } from '@devlusoft/devix'

export const getPost = query(async (id: string) => {
  return db.posts.find(id)
}, 'getPost')

export async function loader({ params }: LoaderContext) {
  return { post: await getPost(params.slug) }
}
```

En cliente, `getPost` usa la caché hidratada desde `window.__DEVIX_QUERIES__`. Si no está en caché, viaja por `POST /_devix/query` RPC.

## Deferred data

### defer()

Marca datos para resolución diferida (no bloquean el render inicial):

```ts
import { defer } from '@devlusoft/devix'

export async function loader({ params }: LoaderContext) {
  const post = db.posts.findBySlug(params.slug)
  const comments = db.comments.findByPost(params.slug)
  return { post, comments: defer(comments) }
}
```

### AwaitData

Resuelve datos diferidos en paralelo y renderiza cuando todos están listos:

```tsx
import { AwaitData } from '@devlusoft/devix'

export default function Post(props: PageProps<typeof loader>) {
  return (
    <div>
      <h1>{props.data.post.title}</h1>
      <AwaitData data={{ comments: props.data.comments }} fallback={<Skeleton />}>
        {({ comments }) => (
          <ul>{comments().map(c => <li>{c.text}</li>)}</ul>
        )}
      </AwaitData>
    </div>
  )
}
```

## Timeout

```ts
export default defineConfig({
  loaderTimeout: '5s',
})
```

Por defecto `10s`. Si el loader supera el tiempo, la petición falla de forma controlada.

## Navegación en el cliente

Al navegar con `<Link>` o `useNavigate`, devix obtiene los datos vía `/_devix/data` y re-renderiza — sin recarga de página.

## Errores

Usa `error()` para retornar un error HTTP controlado desde un loader o guard:

```ts
import { error } from '@devlusoft/devix'

export async function loader({ params }: LoaderContext) {
  const post = await db.posts.find(params.id)
  if (!post) return error(404, 'Post no encontrado')
  return post
}
```

### Opciones: code y data

```ts
return error(404, 'Post no encontrado', {
  code: 'POST_NOT_FOUND',
  data: { postId: params.id },
})
```

Tu `error.tsx` recibe ambos como props:

```tsx
import type { ErrorProps } from '@devlusoft/devix'

export default function ErrorPage(props: ErrorProps) {
  return (
    <div>
      <h1>{props.statusCode}</h1>
      <p>{props.message}</p>
      {props.code === 'POST_NOT_FOUND' && <Link href="/">Volver al inicio</Link>}
    </div>
  )
}
```
