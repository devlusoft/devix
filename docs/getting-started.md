# Primeros pasos

## Requisitos

- Node.js 20+
- React 19+
- Vite 8+

## Instalación

```bash
npm install @devlusoft/devix react react-dom
```

## Estructura del proyecto

Por defecto devix espera tu app en `app/`:

```
mi-app/
├── app/
│   └── pages/
│       └── index.tsx
├── devix.config.ts
└── package.json
```

## devix.config.ts

```ts
import { defineConfig } from '@devlusoft/devix/config'

export default defineConfig({
  port: 3000,
})
```

## Primera página

```tsx
// app/pages/index.tsx
export default function Home() {
  return <h1>¡Hola devix!</h1>
}
```

## Servidor de desarrollo

```bash
npx devix dev
```

Abre `http://localhost:3000`. La página se renderiza en el servidor e hidrata en el cliente automáticamente.

## Producción

```bash
npx devix build
npx devix start
```

## TypeScript

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["app", "devix.config.ts"]
}
```

## Extender Vite

No necesitas `vite.config.ts`. Usa el campo `vite` en tu config:

```ts
export default defineConfig({
  vite: {
    resolve: {
      alias: { '@': '/app' },
    },
  },
})
```
