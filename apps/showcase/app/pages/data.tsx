import { A, createAsync } from '@solidjs/router'
import { Suspense } from 'solid-js'

async function fetchSlowData(): Promise<string> {
  await new Promise((r) => setTimeout(r, 200))
  return `fetched from slow source at ${new Date().toLocaleTimeString()}`
}

export default function DataPage() {
  const data = createAsync(() => fetchSlowData(), { deferStream: false })

  return (
    <section style={{ padding: '1rem' }}>
      <h1>Data page</h1>
      <p>
        The shell below appears immediately. The data replaces the loading
        placeholder after ~200ms.
      </p>
      <Suspense fallback={<p>Loading slow data…</p>}>
        <p>Data: {data() ?? 'pending'}</p>
      </Suspense>
      <p>
        <A href="/">← back to home</A>
      </p>
    </section>
  )
}