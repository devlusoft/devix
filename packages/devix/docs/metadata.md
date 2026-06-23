# Metadata y SEO

## Metadata estática

```ts
import type { Metadata } from '@devlusoft/devix'

export const metadata: Metadata = {
  title: 'Inicio',
  description: 'Bienvenido a mi sitio',
  keywords: ['react', 'ssr', 'devix'],
  canonical: 'https://misitio.com/',
  robots: 'index, follow',
}
```

## Metadata dinámica

Cuando necesitas datos del query:

```ts
import { query } from '@devlusoft/devix'

export const getPost = query(
  async (slug: string) => db.posts.findBySlug(slug),
  'get-post',
)

export async function generateMetadata() {
  // getPost está disponible vía el contexto del request
  // ver docs/queries.md para integración con metadata
  return {
    title: 'Post',
    description: 'Descripción del post',
  } satisfies Metadata
}
```

## Open Graph

```ts
export const metadata: Metadata = {
  og: {
    title: 'Mi página',
    description: 'Descripción',
    image: 'https://misitio.com/og.png',
    type: 'website',  // 'website' | 'article' | 'product'
    url: 'https://misitio.com/',
  },
}
```

## Twitter / X

```ts
export const metadata: Metadata = {
  twitter: {
    card: 'summary_large_image',
    title: 'Mi página',
    image: 'https://misitio.com/og.png',
    creator: '@miusuario',
  },
}
```

## Viewport

```ts
import type { Viewport } from '@devlusoft/devix'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6366f1',
}

export async function generateViewport({ request }) {
  return { themeColor: await getUserTheme(request) }
}
```

## Fusión

La metadata del layout y la página se fusiona — la página gana en conflictos:

```ts
// layout.tsx
export const metadata: Metadata = {
  title: 'Mi Sitio',
  og: { type: 'website', image: '/og-default.png' },
}

// blog/[slug].tsx
export async function generateMetadata() {
  // combina con la metadata del layout
  return {
    title: 'Título específico',
    og: { image: '/cover.jpg' }, // sobreescribe og.image, conserva og.type
  }
}
```

## lang

```ts
export const lang = 'es'

// o dinámico desde el layout raíz
export async function generateLang({ request }) {
  const accept = request.headers.get('Accept-Language') ?? ''
  return accept.startsWith('es') ? 'es' : 'en'
}
```

## Alternates

```ts
export const metadata: Metadata = {
  alternates: {
    en: 'https://misitio.com/en/about',
    es: 'https://misitio.com/es/about',
  },
}
```
