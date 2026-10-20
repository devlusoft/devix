# Contribuir

devlusoft mantiene devix. Si encuentras un bug, abre un issue.

Toda contribución entra por PR y se abre contra `next`.

## Para cerrar un PR

- [ ] CI en verde
- [ ] Cada criterio de su issue está comprobado, con el comando o la evidencia que lo demuestra.
- [ ] Hay un changeset si el PR cambia un paquete publicado. El formato está en [`.changeset/README.md`](.changeset/README.md)
- [ ] La PR cierra su issue, con `Closes #N` en el cuerpo.

## Antes de abrir un PR

```bash
pnpm --filter @devlusoft/devix build
pnpm --filter playground build
```