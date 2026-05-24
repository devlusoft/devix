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
├── profile.ts    → create, update
└── posts.ts      → create, remove
```

Cada archivo en `app/actions/` exporta funciones envueltas con `action()`. devix genera automáticamente un endpoint `POST /_devix/actions/<file>/<fnName>` por cada función.

## Llamar desde el cliente

```tsx
import { create } from '~/actions/posts'  // import directo

const result = await create({ title: 'Hola', content: 'Mundo' })

// En un form
<form onSubmit={async (e) => {
  e.preventDefault()
  await create({ title: 'Hola', content: 'Mundo' })
}}>
```

## Seguridad

El cuerpo de la función `action(fn)` **nunca llega al bundle cliente**. devix detecta automáticamente las llamadas a `action()` en cualquier archivo y reemplaza el argumento función por un stub que lanza error en cliente. Los imports que solo usaba `fn` (DB, tokens, etc.) se eliminan por tree-shaking:

```ts
// Esto NUNCA toca el bundle cliente:
export const create = action(async (data: Input) => {
  const token = getServerSecret()
  return db.query(token, data)
})

// El cliente recibe:
export const create = action(async (...$a) => {
  throw new Error("server-only code")
})
```

Esto funciona para cualquier archivo del proyecto, no solo `app/actions/`.

## Cookies

Dentro de una action puedes leer y escribir cookies del request sin pasar parámetros (ver [Cookies](./cookies.md)):

```ts
// app/actions/auth.ts
import { action } from '@devlusoft/devix'

export const login = action(async (token: string) => {
  setCookie('session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
  })
  return { ok: true }
})

export const logout = action(async () => {
  deleteCookie('session')
  return { ok: true }
})
```

### También funciona el modo explícito

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
