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

Vuelve a ejecutar guards y loaders de la ruta actual sin navegar:

```tsx
import { useRevalidate } from '@devlusoft/devix'

const revalidate = useRevalidate()

// después de una mutación:
await fetch('/api/posts', { method: 'POST', body: JSON.stringify(data) })
await revalidate()
```

### Qué se re-ejecuta

`revalidate()` reproduce el mismo flujo de carga que una navegación entrante:

1. Los **guards** de layouts y de la página actual corren de nuevo (en orden — root layout primero, página al final)
2. Los **loaders** corren después en paralelo (layouts + página)
3. La metadata se vuelve a resolver

Esto significa que:

- Un **redirect** retornado por un guard durante revalidate funciona automáticamente — el router navega al destino sin trabajo extra.
- Una **sesión que expiró** entre la primera carga y la revalidación es detectada en el siguiente `revalidate()`: el guard de auth retorna `/login` y el usuario es redirigido.
- Un **`error()` retornado** por un guard o loader durante revalidate muestra la `error.tsx` correspondiente.

### Caso típico — mutación con re-fetch de datos

```tsx
import { $fetch, useRevalidate } from '@devlusoft/devix'

function DeleteButton({ id }: { id: string }) {
    const revalidate = useRevalidate()

    return (
        <button onClick={async () => {
            await $fetch(`/api/posts/${id}`, { method: 'DELETE' })
            await revalidate()  // re-fetch del listado
        }}>
            Eliminar
        </button>
    )
}
```

### Caso típico — login/logout que invalida la sesión

```tsx
async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await revalidate()
    // el guard de la ruta actual detecta que no hay sesión y redirige a /login
}
```

> ⚠️ Múltiples llamadas concurrentes a `revalidate()` no se cancelan entre sí — la última en resolver gana. Si encadenas mutaciones rápidas, `await` la revalidación anterior antes de disparar la siguiente.

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
