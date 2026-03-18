# Configuración

```ts
// devix.config.ts
import {defineConfig} from '@devlusoft/devix/config'

export default defineConfig({
    port: 3000,
    host: false,
    appDir: 'app',
    output: 'server',
    loaderTimeout: '10s',
    css: ['./app/styles/global.css'],
    envPrefix: 'PUBLIC_',
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

### `output`

- `'server'` — SSR: `devix start` maneja las peticiones dinámicamente
- `'static'` — SSG: `devix generate` pre-renderiza todo; `devix start` sirve archivos estáticos

### `loaderTimeout`

Tiempo máximo de ejecución para loaders y guards. Acepta número en ms o string con unidad: `'5s'`, `'2m'`, `'500ms'`,
`'1h'`. Default: `'10s'`.

### `css`

Archivos CSS globales inyectados en cada página. Rutas relativas a la raíz del proyecto.

### `envPrefix`

Variables de entorno con este prefijo se exponen al cliente vía `import.meta.env`. Default: `'VITE_'`.

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
