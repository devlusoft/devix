# Carga de datos (deprecated)

> **Deprecado:** El sistema `loader` / `useLoaderData` / `PageProps.data` / `LayoutProps.data` / `defer` / `AwaitData` / `loaderTimeout` está deprecado.
> Para carga de datos usa `query()` + `createAsync()` + `<Suspense>`.
> Consulta [Query System](./query-system.md).

```tsx
import { createAsync } from '@devlusoft/devix'
import { getPost } from '~/queries/posts'

export default function PostPage({ params }: { params: { slug: string } }) {
  const post = createAsync(() => getPost(params.slug))
  return <h1>{post()?.title}</h1>
}
```

Para datos del lado del servidor, usa `"use server"` en la función de query.

Las funciones `guard`, `useGuardData`, `useParams` y `error()` no están deprecadas.
