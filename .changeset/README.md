# Changesets

Este directorio usa [Changesets](https://github.com/changesets/changesets) para gestionar versiones y el CHANGELOG.

## Cómo agregar un changeset

Cada PR que introduzca un cambio publicable debe incluir un archivo `.changeset/<nombre-random>.md` con este formato:

```md
---
"@devlusoft/devix": minor
---

Descripción user-facing del cambio. Una o dos líneas, sin detalles internos.
```

El primer campo (`@devlusoft/devix`) es el nombre del paquete (debe coincidir con el campo `name` en `package.json`). El valor a la derecha es el tipo de bump:

- `patch` — bug fix, cambio interno sin breaking change
- `minor` — nueva feature compatible
- `major` — breaking change (cualquier `BREAKING CHANGE:` en commit o cambio incompat)

## Flujo de release

1. Vos abrís PR con un archivo `.changeset/*.md`.
2. Al mergear, un bot abre/actualiza un PR "Version Packages" con la versión bump, CHANGELOG actualizado y publish a npm.
3. Al mergear ese PR, el paquete se publica en npm.

## Modo prerelease

Estamos en modo `alpha` mientras el framework está en desarrollo. Para salir del modo prerelease:

```bash
pnpm changeset pre exit
```

Esto deja de generar versiones `alpha` y vuelve a `0.x.y`/`x.y.z` normal.

## Nombre del archivo

El nombre del archivo no importa. Usá algo descriptivo del cambio, kebab-case:

```
fix-suspense-hydration.md
feat-action-handling.md
chore-bump-vite.md
```

`pnpm changeset` (interactivo) genera uno con nombre aleatorio si no querés pensarlo.