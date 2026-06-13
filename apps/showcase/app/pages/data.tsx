import { A } from '@solidjs/router'
import { createResource, For, Show, Suspense } from 'solid-js'
import { getUser, listUsers } from '../data/users'

export default function DataPage() {
  const [users] = createResource(() => listUsers())

  return (
    <section style={{ padding: '1rem' }}>
      <h1>Data page</h1>
      <p>Users loaded from a server-only query via RPC to /_server:</p>
      <Suspense fallback={<p>Loading users…</p>}>
        <ul>
          <For each={users() ?? []}>
            {(u) => (
              <li>
                <A href={`/data/${u.id}`}>{u.name}</A>
              </li>
            )}
          </For>
        </ul>
      </Suspense>
      <Suspense fallback={<p>Loading first user…</p>}>
        <FirstUserCard />
      </Suspense>
      <p>
        <A href="/">← back to home</A>
      </p>
    </section>
  )
}

function FirstUserCard() {
  const [user] = createResource(() => getUser('1'))
  return (
    <Show when={user()}>
      {(u) => (
        <article style={{ 'margin-top': '1rem', padding: '0.5rem', border: '1px solid #ccc' }}>
          <strong>{u().name}</strong>
          <span style={{ 'margin-left': '0.5rem', color: '#666' }}>id: {u().id}</span>
        </article>
      )}
    </Show>
  )
}
