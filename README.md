# devix monorepo

Este monorepo contiene los paquetes oficiales del framework **devix** y su ecosistema.

## Paquetes

| Paquete                                   | Descripción                                                                |
|-------------------------------------------|----------------------------------------------------------------------------|
| [`@devlusoft/devix`](./packages/devix)    | Plugin de Vite sobre Solid 2 - activa el modo `start` con SSR              |
| [`create-devix`](./packages/create-devix) | Scaffolder oficial para crear nuevos proyectos devix (`npm create devix`). |

## Desarrollo

Requiere Node >= 22.18, pnpm 12.

```bash
pnpm install           # instala dependencias de todo el workspace
pnpm typecheck         # typecheck del framework y del playground
pnpm build             # compila el framework
pnpm dev               # arranca el dev server del framework
```

Para apuntar a un paquete específico:

```bash
pnpm --filter @devlusoft/devix typecheck
pnpm --filter playground dev
```

## Apps

| App                                    | Descripción                                                   |
|----------------------------------------|---------------------------------------------------------------|
| [`apps/playground`](./apps/playground) | App minima: `devix` sirviendo `/` renderizado en el servidor. |

## Estado

devix está en desarrollo activo. `main` publica las versiones estables, `develop` lleva la linea de React y `next` lleva
la reescritura sobre Solid v2.

## Licencia

MIT — devix es un proyecto de [devlusoft](https://www.devlusoft.com).

Ver [`LICENSE`](./LICENSE) para el texto completo.
