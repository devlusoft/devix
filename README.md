# devix

Un meta-framework ligero de **SolidJS** con SSR, impulsado por Vite 8 + Hono.

Construye aplicaciones SolidJS full-stack con enrutamiento basado en archivos, renderizado del lado del servidor, generación estática de sitios y rutas API — configuración mínima, control máximo.

## Características

- **Vite 8** — HMR instantáneo y builds rápidos con Rolldown
- **SolidJS 1.9** — SSR con `renderToString` e `hydrateRoot`. Sin VDOM, JSX compilado a DOM real
- **Enrutamiento basado en archivos** — páginas, layouts anidados y rutas API desde el sistema de archivos
- **SSR por defecto** — cada página se renderiza en el servidor
- **SSG** — genera HTML estático con `generateStaticParams`
- **Query system** — queries nombradas con deduplicación automática por request y caché cliente
- **Rutas API** — basadas en archivos, con `createHandler` para tipado de extremo a extremo
- **$fetch** — cliente HTTP con body y respuesta tipados, con autocompletado de rutas
- **$server** — proxy a backends remotos con auth pass-through y allowlist (multi-backend, tipo via generic en el call site)
- **Validación de body** — soporte de [Standard Schema](https://standardschema.dev) (Zod, Valibot, ArkType) en `createHandler` con error shape automático
- **Error shape unificado** — `error()` y `DevixError` producen el mismo `{ statusCode, code, message }` en guards y handlers
- **Guards de ruta** — redirecciones del lado del servidor antes del renderizado, con `useGuardData()` para leer datos del guard sin loader
- **Navegación programática** — `useNavigate()` con soporte de `replace` y View Transitions API
- **Revalidación de datos** — `useRevalidate()` para refrescar guards sin recargar la página
- **SEO** — `metadata` y `generateMetadata` por página, con soporte de Open Graph
- **TypeScript primero** — inferencia de tipos completa en todo el framework

## Instalación

```bash
npm install @devlusoft/devix solid-js
```

Requiere SolidJS 1.9+, Vite 8+, Node 20+.

## Inicio rápido

```bash
npx devix dev
```

**1. Crea `devix.config.ts`:**

```ts
import { defineConfig } from '@devlusoft/devix/config'

export default defineConfig({
  port: 3000,
})
```

**2. Crea tu primera página en `app/pages/index.tsx`:**

```tsx
export default function Home() {
  return <h1>¡Hola devix!</h1>
}
```

**3. Ejecuta el servidor de desarrollo:**

```bash
npx devix dev
```

## Convenciones de archivos

```
app/
├── pages/
│   ├── layout.tsx          # Layout raíz (envuelve todas las páginas)
│   ├── index.tsx           # → /
│   ├── about.tsx           # → /about
│   └── blog/
│       ├── layout.tsx      # Layout anidado (envuelve páginas de blog)
│       ├── index.tsx       # → /blog
│       └── [slug].tsx      # → /blog/:slug
└── api/
    ├── middleware.ts        # Middleware global de la API
    └── posts/
        └── [id].ts         # → GET/POST /api/posts/:id
```

## Conceptos principales

### Guard de ruta

```ts
export async function guard({ request }: LoaderContext) {
  const user = await getSession(request)
  if (!user) return '/login'
  return null
}
```

### Metadata

```ts
export const metadata = {
  title: 'Inicio',
  description: 'Bienvenido a mi sitio',
  og: { image: '/og.png', type: 'website' },
}

// o dinámica:
export async function generateMetadata() {
  return { title: 'Título dinámico' }
}
```

### Layouts

```tsx
import type { LayoutProps } from '@devlusoft/devix'

export default function RootLayout(props: LayoutProps) {
  return (
    <div>
      <nav>...</nav>
      {props.children}
    </div>
  )
}
```

### Navegación programática

```tsx
import { useNavigate, useRevalidate } from '@devlusoft/devix'

function MyComponent() {
  const navigate = useNavigate()
  const revalidate = useRevalidate()

  return (
    <>
      <button onClick={() => navigate('/dashboard')}>Ir al dashboard</button>
      <button onClick={() => navigate('/login', { replace: true })}>Login (sin historial)</button>
      <button onClick={() => navigate('/shop', { viewTransition: true })}>Con animación</button>
      <button onClick={() => revalidate()}>Refrescar datos</button>
    </>
  )
}
```

### Rutas API

`createHandler` da tipado de extremo a extremo — el body y el retorno se infieren automáticamente para `$fetch`. El segundo argumento `ctx` expone `request`, `url`, `params`, `$server` y state heredado de middleware:

```ts
import { createHandler, json, error } from '@devlusoft/devix'

export const GET = createHandler(async (_body, ctx) => {
  const filter = ctx.url.searchParams.get('filter')
  return await db.items.find({ filter })
})

export const POST = createHandler(async (body: { name: string }, ctx) => {
  const user = ctx.get<User>('user')
  if (!user) return error(401, 'No autenticado')
  const item = await db.items.create({ ...body, ownerId: user.id })
  return json(item, 201)
})
```

Con [Standard Schema](https://standardschema.dev) la validación es automática:

```ts
import { z } from 'zod'

const Input = z.object({ name: z.string().min(1) })

export const POST = createHandler(Input, async (body, ctx) => {
  return await db.items.create(body)
})
```

```ts
// Cliente — tipado completo
const res = await $fetch('/api/items', {
  method: 'POST',
  body: { name: 'nuevo item' },
})
```

### Backend remoto con `$server`

```ts
// devix.config.ts
import { defineConfig } from '@devlusoft/devix/config'
import { getCookie } from '@devlusoft/devix'

export default defineConfig({
  server: {
    api: {
      url: process.env.API_URL!,
      prepare: ({ request, headers }) => {
        const sid = getCookie(request, 'sid')
        if (sid) headers.set('Authorization', `Bearer ${sid}`)
      },
      allowedPaths: ['/v1/**'],
    },
  },
})
```

```ts
import { $server } from '@devlusoft/devix'
const me = await $server.api.get<User>('/v1/me')
```

### Query system

```ts
import { query } from '@devlusoft/devix'

export const getPost = query(async (id: string) => {
  return db.posts.find(id)
}, 'getPost')
```

Deduplicación automática por request. Caché cliente hidratada desde `window.__DEVIX_QUERIES__`.

### Generación estática (SSG)

```ts
// devix.config.ts
export default defineConfig({ output: 'static' })
```

```ts
// app/pages/blog/[slug].tsx
export async function generateStaticParams() {
  const posts = await db.posts.all()
  return posts.map(p => ({ slug: p.slug }))
}
```

```bash
npx devix generate
npx devix start
```

## Comandos

| Comando          | Descripción                                     |
|------------------|-------------------------------------------------|
| `devix dev`      | Inicia el servidor de desarrollo con HMR        |
| `devix build`    | Compila para producción                         |
| `devix start`    | Inicia el servidor de producción                |
| `devix generate` | Compila y pre-renderiza todas las páginas (SSG) |

## Configuración

```ts
// devix.config.ts
import { defineConfig } from '@devlusoft/devix/config'

export default defineConfig({
  port: 3000,
  host: false,
  appDir: 'app',
  publicDir: 'public',
  output: 'server',
  css: ['./app/styles/global.css'],
  envPrefix: 'PUBLIC_',
  vite: {},
})
```

## Documentación

La documentación completa está en la carpeta [`docs/`](./docs):

- [Primeros pasos](./docs/getting-started.md)
- [Enrutamiento](./docs/routing.md)
- [Layouts](./docs/layouts.md)
- [Carga de datos](./docs/data-loading.md)
- [Query System](./docs/query-system.md)
- [Server Actions](./docs/actions.md)
- [Rutas API](./docs/api-routes.md)
- [Backend remoto con `$server`](./docs/server-primitive.md)
- [Metadata y SEO](./docs/metadata.md)
- [Generación estática (SSG)](./docs/ssg.md)
- [Configuración](./docs/configuration.md)

## Licencia

MIT — devix es un proyecto de [devlusoft](https://www.devlusoft.com).
