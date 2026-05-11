# devix

Un meta-framework ligero de React 19 con SSR, impulsado por Vite 8 + Hono.

Construye aplicaciones React full-stack con enrutamiento basado en archivos, renderizado del lado del servidor, generación estática de sitios y rutas API — configuración mínima, control máximo.

## Características

- **Vite 8** — HMR instantáneo y builds rápidos con Rolldown
- **React 19** — SSR con `renderToString` e `hydrateRoot`
- **Enrutamiento basado en archivos** — páginas, layouts anidados y rutas API desde el sistema de archivos
- **SSR por defecto** — cada página se renderiza en el servidor
- **SSG** — genera HTML estático con `generateStaticParams`
- **Rutas API** — basadas en archivos, con `createHandler` para tipado de extremo a extremo
- **$fetch** — cliente HTTP con body y respuesta tipados, con autocompletado de rutas
- **$server** — proxy tipado a backends remotos con auth pass-through y allowlist (multi-backend)
- **Validación de body** — soporte de [Standard Schema](https://standardschema.dev) (Zod, Valibot, ArkType) en `createHandler` con error shape automático
- **Error shape unificado** — `error()` y `DevixError` producen el mismo `{ statusCode, code, message }` en loaders, guards y handlers
- **Carga de datos** — funciones `loader` con hidratación automática en el cliente
- **Guards de ruta** — redirecciones del lado del servidor antes del renderizado, con `useGuardData()` para leer datos del guard sin loader
- **Navegación programática** — `useNavigate()` con soporte de `replace` y View Transitions API
- **Revalidación de datos** — `useRevalidate()` para refrescar guards y loaders sin recargar la página
- **SEO** — `metadata` y `generateMetadata` por página, con soporte de Open Graph y Twitter
- **TypeScript primero** — inferencia de tipos completa en todo el framework

## Instalación

```bash
npm install @devlusoft/devix react react-dom
```

Requiere React 19+, Vite 8+, Node 20+.

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

### Loader y datos

```tsx
import { useLoaderData } from '@devlusoft/devix'
import type { PageProps, LoaderContext } from '@devlusoft/devix'

export async function loader({ params, request }: LoaderContext) {
  const post = await db.posts.findBySlug(params.slug)
  return post
}

export default function BlogPost({ data, params }: PageProps<typeof loader>) {
  return <article>{data.title}</article>
}
```

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
  twitter: { card: 'summary_large_image' },
}

// o dinámica:
export async function generateMetadata({ loaderData }) {
  return { title: loaderData.title }
}
```

### Layouts

```tsx
import type { LayoutProps } from '@devlusoft/devix'

export default function RootLayout({ children }: LayoutProps) {
  return (
    <div>
      <nav>...</nav>
      {children}
    </div>
  )
}
```

### Tipado de params

Pasa el tipo de params directamente sin necesidad de un loader:

```tsx
import type { PageProps } from '@devlusoft/devix'

export default function ProviderPage({ params }: PageProps<{ providerId: string }>) {
  return <h1>{params.providerId}</h1>
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

### redirect con replace

```ts
import { redirect } from '@devlusoft/devix'

export async function loader({ request }: LoaderContext) {
  const user = await getSession(request)
  if (!user) return redirect('/login', { replace: true })
  return user
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
  const user = ctx.get<User>('user')  // del middleware
  if (!user) return error(401, 'No autenticado')
  const item = await db.items.create({ ...body, ownerId: user.id })
  return json(item, 201)
})

export const DELETE = createHandler(async () => null)  // 204
```

Con [Standard Schema](https://standardschema.dev) la validación es automática — si el body no cumple, devix responde `400` con el shape `{ statusCode, code, message, data: { issues } }`:

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

Llama a tu API (Go, Rails, microservicios) directamente desde loaders, handlers y componentes — devix se encarga del proxy y del auth pass-through. Multi-backend soportado.

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
// Loader/handler — $server bound al request del usuario
export async function loader({ $server, params }: LoaderContext) {
  return await $server.api.get(`/v1/posts/${params.id}`)
}

// Cliente — pasa por el proxy interno con el mismo prepare
import { $server } from '@devlusoft/devix'
const me = await $server.api.get('/v1/me')
```

> ⚠️ `$server` reenvía credenciales del usuario al backend (el backend valida). **No lo uses para APIs de terceros con keys del server (Stripe, etc.)** — eso expone esa key. Para terceros, escribe un handler explícito con autorización propia. Ver [Server primitive](./docs/server-primitive.md).

### Generación estática (SSG)

Configura `output: 'static'` y exporta `generateStaticParams` desde cualquier página dinámica:

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
npx devix generate   # compila y pre-renderiza todas las páginas en dist/client/
npx devix start      # sirve los archivos estáticos (sin SSR en runtime)
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
  port: 3000,                // puerto del servidor dev y producción (default: 3000)
  host: false,               // bind a 0.0.0.0 (default: false)
  appDir: 'app',             // directorio de la app (default: 'app')
  publicDir: 'public',       // directorio de archivos estáticos (default: 'public')
  output: 'server',          // 'server' | 'static' (default: 'server')
  loaderTimeout: 10_000,     // timeout de los loaders en ms (default: 10000)
  css: ['./app/styles/global.css'],  // archivos CSS globales
  envPrefix: 'PUBLIC_',      // expone variables de entorno con este prefijo al cliente
  vite: {},                  // extiende la configuración de Vite
})
```

## Documentación

La documentación completa está en la carpeta [`docs/`](./docs):

- [Primeros pasos](./docs/getting-started.md)
- [Enrutamiento](./docs/routing.md)
- [Layouts](./docs/layouts.md)
- [Carga de datos](./docs/data-loading.md)
- [Rutas API](./docs/api-routes.md)
- [Backend remoto con `$server`](./docs/server-primitive.md)
- [Metadata y SEO](./docs/metadata.md)
- [Generación estática (SSG)](./docs/ssg.md)
- [Configuración](./docs/configuration.md)

## Licencia

MIT — devix es un proyecto de [devlusoft](https://www.devlusoft.com).
