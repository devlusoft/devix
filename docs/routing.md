# Enrutamiento

Los archivos dentro de `app/pages/` se convierten en rutas automáticamente.

## Rutas estáticas

| Archivo                    | Ruta        |
|----------------------------|-------------|
| `app/pages/index.tsx`      | `/`         |
| `app/pages/about.tsx`      | `/about`    |
| `app/pages/blog/index.tsx` | `/blog`     |
| `app/pages/blog/new.tsx`   | `/blog/new` |

## Rutas dinámicas

Los segmentos entre corchetes se convierten en params:

| Archivo                         | Ruta             |
|---------------------------------|------------------|
| `app/pages/blog/[slug].tsx`     | `/blog/:slug`    |
| `app/pages/[category]/[id].tsx` | `/:category/:id` |

Las rutas estáticas tienen prioridad sobre las dinámicas. `/blog/new` siempre gana sobre `/blog/:slug`.

## Params

Disponibles en `loader`, `guard`, `generateMetadata` y como props de la página:

```tsx
import type { PageProps, LoaderContext } from '@devlusoft/devix'

export async function loader({ params }: LoaderContext<{ slug: string }>) {
  return db.posts.findBySlug(params.slug)
}

export default function Page({ params }: PageProps) {
  return <p>{params.slug}</p>
}
```

## Link

```tsx
import { Link } from '@devlusoft/devix';

<Link href="/blog/hola-mundo">Post</Link>
```

Hace prefetch del loader al hacer hover con `prefetch`:

```tsx
<Link href="/blog/hola-mundo" prefetch>Post</Link>
```

Usa la [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API) con `viewTransition`:

```tsx
<Link href="/blog/hola-mundo" viewTransition>Post</Link>
```

Hace fallback silencioso en navegadores que no soporten la API.

## Navegación programática

```tsx
import { useNavigate } from '@devlusoft/devix'

const navigate = useNavigate()
navigate('/dashboard')
```

## Estado del router

```tsx
import { useRouter, useParams } from '@devlusoft/devix'

const { pathname } = useRouter()
const { slug } = useParams<{ slug: string }>()
```

## useRevalidate

Vuelve a ejecutar el loader de la página actual sin navegar:

```tsx
import { useRevalidate } from '@devlusoft/devix'

const revalidate = useRevalidate()

// después de una mutación:
await fetch('/api/posts', { method: 'POST', body: JSON.stringify(data) })
await revalidate()
```

## Archivos reservados

| Archivo | Uso |
|---|---|
| `layout.tsx` | Layout que envuelve las páginas del mismo directorio |
| `error.tsx` | Página de error para esa ruta y sus subrutas |

## error.tsx

Un archivo `error.tsx` captura errores del loader y del renderizado en el mismo directorio y sus subdirectorios.

```tsx
// app/pages/error.tsx  ← captura errores globales
import type { ErrorProps } from '@devlusoft/devix'

export default function ErrorPage({ statusCode, message }: ErrorProps) {
  return (
    <div>
      <h1>{statusCode}</h1>
      <p>{message}</p>
    </div>
  )
}
```

```tsx
// app/pages/blog/error.tsx  ← solo errores bajo /blog
import type { ErrorProps } from '@devlusoft/devix'

export default function BlogError({ statusCode, message }: ErrorProps) {
  return <p>Error en el blog: {statusCode} — {message}</p>
}
```

`ErrorProps` tiene tres campos: `statusCode: number`, `message?: string`, `data?: unknown`.
