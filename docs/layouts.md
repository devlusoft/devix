# Layouts

Un archivo `layout.tsx` envuelve automáticamente todas las páginas del mismo directorio y subdirectorios.

## Layout raíz

```tsx
// app/pages/layout.tsx
import type { LayoutProps } from '@devlusoft/devix'

export default function RootLayout(props: LayoutProps) {
  return (
    <div>
      <header>Mi App</header>
      <main>{props.children}</main>
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

