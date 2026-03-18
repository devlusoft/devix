# Layouts

Un archivo `layout.tsx` envuelve automáticamente todas las páginas del mismo directorio y subdirectorios.

## Layout raíz

```tsx
// app/pages/layout.tsx
import type { LayoutProps } from '@devlusoft/devix'

export default function RootLayout({ children }: LayoutProps) {
  return (
    <div>
      <header>Mi App</header>
      <main>{children}</main>
    </div>
  )
}
```

## Layouts anidados

```
app/pages/
├── layout.tsx
├── index.tsx
└── blog/
    ├── layout.tsx   ← se renderiza dentro del layout raíz
    ├── index.tsx
    └── [slug].tsx
```

La cadena `RootLayout → BlogLayout → Page` se ensambla en el servidor.

## Loader en el layout

Los loaders de layouts corren en paralelo con el loader de la página:

```tsx
import type { LayoutProps, LoaderContext } from '@devlusoft/devix'

export async function loader({ request }: LoaderContext) {
  return { user: await getUser(request) }
}

export default function RootLayout({ children, data }: LayoutProps<{ user: User }>) {
  return (
    <div>
      <header>
        {data.user ? data.user.name : <a href="/login">Iniciar sesión</a>}
      </header>
      {children}
    </div>
  )
}
```

## Atributo lang

Solo aplica desde el layout raíz:

```ts
// estático
export const lang = 'es'

// dinámico
export async function generateLang({ request }: LoaderContext) {
  const accept = request.headers.get('Accept-Language') ?? ''
  return accept.startsWith('es') ? 'es' : 'en'
}
```

## Datos del layout en el cliente

Usa `useLoaderData()` dentro del layout para acceder a sus datos en el cliente.
