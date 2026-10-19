# devix

Plugin de Vite sobre Solid 2. `devix()` activa el modo `start` de `@solidjs/vite-plugin` con SSR: el servidor de desarrollo de Vite sirve la app renderizada en el servidor y la hidrata en el cliente.

## Instalación

```bash
npm install -D @devlusoft/devix
npm install solid-js @solidjs/web
npm install -D vite
```

## Uso

Registra el plugin en tu vite.config.ts

```js
import devix from '@devlusoft/devix'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [devix()]
})
```

Y levanta el servidor de desarrollo:

```bash
npx vite
```

## Convenciones

El plugin busca la app en dos archivos:

```
app/
├── app.tsx         # componente raiz
├── document.tsx    # shell del documento - html, head, body
```

`app/app.tsx` exporta el componente raíz:

```typescript jsx
export default function App() {
  return (
    <h1>Hola devix</h1>
  )
}
```

`app/document.tsx` recibe la app como props.children y renderiza el documento completo, incluido el `<HydrationScript />` que activa la hidratación:

```typescript jsx
import { HydrationScript } from '@solidjs/web'
import type { ParentProps } from 'solid-js'

export default function Document(props: ParentProps) {
  return (
    <html lang="es">
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1"/>
      <title>devix playground</title>
      <HydrationScript/>
    </head>
    <body>{props.children}</body>
    </html>
  )
}
```

## Requisitos

- Node >= 22.18
- Solid 2 (`solid-js`, `@solidjs/web`)
- Vite 8

## Estado

devix está en alpha. Esta versión solo aporta el arranque.

