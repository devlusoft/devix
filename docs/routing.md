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

## Archivos reservados

| Archivo | Uso |
|---|---|
| `layout.tsx` | Layout que envuelve las páginas del mismo directorio |
| `error.tsx` | Límite de error _(próximamente)_ |
