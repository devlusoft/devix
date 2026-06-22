# Configuración

```ts
// devix.config.ts
import {defineConfig} from '@devlusoft/devix/config'

export default defineConfig({
    port: 3000,
    host: false,
    appDir: 'app',
    publicDir: 'public',
    output: 'server',
    loaderTimeout: '10s',
    css: ['./app/styles/global.css'],
    envPrefix: 'PUBLIC_',
    html: { lang: 'es' },
    vite: {},
})
```

## Referencia

### `port`

Puerto del servidor. Default: `3000`. Se puede sobreescribir con la variable de entorno `PORT`.

### `host`

- `false` — escucha solo en `localhost`
- `true` — escucha en `0.0.0.0` (accesible en red local)
- `string` — hostname específico

### `appDir`

Directorio raíz de la app. Default: `'app'`. Las páginas van en `{appDir}/pages/` y las rutas API en `{appDir}/api/`.

### `publicDir`

Directorio de archivos estáticos servidos en la raíz del sitio. Default: `'public'`. Los archivos en este directorio se copian tal cual a `dist/client/` durante el build y son accesibles en la misma ruta (p.ej. `public/logo.png` → `/logo.png`).

### `output`

- `'server'` — SSR: `devix start` maneja las peticiones dinámicamente
- `'static'` — SSG: `devix generate` pre-renderiza todo; `devix start` sirve archivos estáticos

### `loaderTimeout`

Tiempo máximo de ejecución para loaders y guards. Acepta número en ms o string con unidad: `'5s'`, `'2m'`, `'500ms'`,
`'1h'`. Default: `'10s'`.

### `css`

Archivos CSS globales inyectados en cada página. Rutas relativas a la raíz del proyecto.

### `envPrefix`

Variables de entorno con este prefijo se exponen al cliente vía `import.meta.env`. Acepta `string` o `string[]`. Default: `'VITE_'`.

### `html`

Opciones del documento HTML raíz:

```ts
export default defineConfig({
  html: { lang: 'es' },
})
```

- `lang` — atributo `lang` del `<html>`. Equivalente a `export const lang = 'es'` en el layout raíz, pero aplica como valor por defecto global cuando no hay layout.

### `vite`

Configuración de Vite adicional. Se fusiona con la configuración base de devix usando `mergeConfig`.

## Variables de entorno

```ts
// devix.config.ts
export default defineConfig({envPrefix: 'PUBLIC_'})

// en tu página
const apiUrl = import.meta.env.PUBLIC_API_URL
```

Las variables sin prefijo solo están disponibles en loaders, guards y rutas API.

## Archivos .env

```
.env
.env.local
.env.production
.env.development
```
