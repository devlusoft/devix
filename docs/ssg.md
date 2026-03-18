# Generación estática (SSG)

devix puede pre-renderizar todas las páginas a HTML estático en tiempo de compilación.

## Configuración

```ts
// devix.config.ts
export default defineConfig({
  output: 'static',
})
```

## Generar

```bash
npx devix generate
```

1. Build de Vite (cliente + servidor)
2. Descubre rutas estáticas
3. Llama `generateStaticParams` en rutas dinámicas
4. Renderiza cada página y escribe en `dist/client/`

## Rutas estáticas

Se incluyen automáticamente:

```
app/pages/index.tsx       → dist/client/index.html
app/pages/about.tsx       → dist/client/about/index.html
app/pages/blog/index.tsx  → dist/client/blog/index.html
```

## Rutas dinámicas

Exporta `generateStaticParams` con todas las combinaciones de params:

```tsx
// app/pages/blog/[slug].tsx
export async function generateStaticParams() {
  const posts = await db.posts.all()
  return posts.map(p => ({ slug: p.slug }))
}

export async function loader({ params }: LoaderContext<{ slug: string }>) {
  return db.posts.findBySlug(params.slug)
}

export default function Post({ data }: PageProps<typeof loader>) {
  return <article>{data.title}</article>
}
```

Las rutas dinámicas sin `generateStaticParams` se omiten.

## Múltiples params

```ts
export async function generateStaticParams() {
  return [
    { category: 'noticias', slug: 'ultima-hora' },
    { category: 'tech', slug: 'ia-actualidad' },
  ]
}
```

## Servir el sitio

```bash
npx devix start  # sirve dist/client/ sin SSR
```

O despliega `dist/client/` directamente en Netlify, Cloudflare Pages, S3, etc.

## Loaders en SSG

Los loaders corren en tiempo de generación, no de petición. Pueden acceder a base de datos, APIs, archivos — el resultado queda serializado en el HTML.

## Limitaciones

- Las rutas API no están disponibles — requieren servidor
- Contenido dinámico por usuario requiere fetch desde el cliente
- Páginas que dependen de cookies o headers de autenticación no se pueden generar estáticamente
