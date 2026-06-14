import { A, createAsync, useParams } from '@solidjs/router'
import { Show, Suspense } from 'solid-js'
import { getUser } from '../../data/users'

export default function UserPage() {
  const params = useParams<{ id: string }>()
  const user = createAsync(() => getUser(params.id), { deferStream: true })

  return (
    <section style={{ padding: '1rem' }}>
      <Suspense fallback={<p>Loading user…</p>}>
        <Show
          when={user()}
          fallback={
            <p>
              User {params.id} not found. <A href="/data">← back</A>
            </p>
          }
        >
          {(u) => (
            <article>
              <h1>{u().name}</h1>
              <p>id: {u().id}</p>
              <p>
                <A href="/data">← back to list</A>
              </p>
            </article>
          )}
        </Show>
      </Suspense>
    </section>
  )
}
