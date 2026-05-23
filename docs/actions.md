# Server Actions

Funciones RPC ejecutadas en servidor, llamables desde cualquier contexto cliente — forms, event handlers, effects. Sin crear endpoints explícitos.

## action()

Las acciones se definen con `action()`, wrapper consistente con `query()`:

```ts
// app/actions/posts.ts
import { action, error } from '@devlusoft/devix'

export const create = action(async (data: { title: string; content: string }) => {
  const post = await db.posts.create(data)
  return { id: post.id }
})

export const remove = action(async (id: string) => {
  const post = await db.posts.find(id)
  if (!post) return error(404, 'Post no encontrado')
  await db.posts.delete(id)
})
```

## Estructura

```
app/actions/
├── profile.ts    → actions.profile.get(), actions.profile.update()
└── posts.ts      → actions.posts.create(), actions.posts.delete()
```

Cada archivo en `app/actions/` exporta funciones envueltas con `action()`. devix genera automáticamente un endpoint `POST /_devix/actions/<namespace>/<fnName>` por cada función.

## Llamar desde el cliente

```tsx
import { actions } from '@devlusoft/devix'

const result = await actions.posts.create({ title: 'Hola', content: 'Mundo' })

// En un form
<form onSubmit={async (e) => {
  e.preventDefault()
  await actions.posts.create({ title: 'Hola', content: 'Mundo' })
}}>
```

Formato: `actions.<file>.<fn>(args)`. Tipado E2E generado automáticamente.

## Con contexto (request)

El segundo parámetro opcional `ctx` expone `request`:

```ts
// app/actions/profile.ts
import { action } from '@devlusoft/devix'
import type { ActionCtx } from '@devlusoft/devix'

export const update = action(async (data: { name: string }, ctx: ActionCtx) => {
  const user = await getSession(ctx.request)
  if (!user) return error(401, 'No autenticado')
  return db.profiles.update(user.id, data)
})
```

## FormData

Si pasas un solo `FormData`, se envía sin transformar:

```tsx
async function handleUpload(e: Event) {
  const fd = new FormData(e.currentTarget as HTMLFormElement)
  await actions.upload.image(fd)
}
```

## Redirect

Las actions pueden redirigir retornando `{ redirect: '/nueva-ruta' }`. El cliente sigue la redirección automáticamente.

## Tipado E2E

devix genera `.devix/actions.d.ts` automáticamente al arrancar (`devix dev` o `devix build`). Los tipos se infieren de las funciones — `actions.posts.create()` tiene argumentos y retorno tipados sin declaraciones manuales.
