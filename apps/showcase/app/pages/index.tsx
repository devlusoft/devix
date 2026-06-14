import { A } from '@solidjs/router'
import { createSignal } from 'solid-js'

export default function Home() {
  const [count, setCount] = createSignal(0)
  return (
    <>
      <h1>Hello World</h1>
      <button type="button" onclick={() => setCount(count() + 1)}>
        Count: {count()}
      </button>
      <p>
        <A href="/blog">Go to blog →</A>
        {' · '}
        <A href="/data">Go to data (streaming) →</A>
        {' · '}
        <A href="/transitions/red">View transitions →</A>
      </p>
    </>
  )
}
