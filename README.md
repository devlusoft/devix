# devix monorepo

Este monorepo contiene los paquetes oficiales del framework **devix** y su ecosistema.

## Paquetes

| Paquete | Descripción |
|---------|-------------|
| [`@devlusoft/devix`](./packages/devix) | Meta-framework React 19 SSR sobre Vite 8 + Hono — file-based routing, loaders, guards, API routes, $server backend proxy, SSG. |
| [`create-devix`](./packages/create-devix) | Scaffolder oficial para crear nuevos proyectos devix (`npm create devix`). |

## Desarrollo

Este es un monorepo gestionado con **pnpm workspaces**. Requisitos: Node ≥ 20, pnpm 11.

```bash
pnpm install           # instala dependencias de todo el workspace
pnpm test:run          # corre los tests del framework
pnpm build             # compila el framework
pnpm dev               # arranca el dev server del framework
```

Para apuntar a un paquete específico:

```bash
pnpm --filter @devlusoft/devix test:run
pnpm --filter create-devix build
```

## Apps

| App | Descripción |
|-----|-------------|
| [`apps/showcase`](./apps/showcase) | App de ejemplo (Task Manager) construida con devix. |

## Estado

devix está en desarrollo activo (0.9.x-alpha). API puede cambiar entre versiones alpha. Las versiones estables se publican desde la rama `main`; las versiones alpha desde `develop`.

## Licencia

MIT — devix es un proyecto de [devlusoft](https://www.devlusoft.com).

Ver [`LICENSE`](./LICENSE) para el texto completo.
