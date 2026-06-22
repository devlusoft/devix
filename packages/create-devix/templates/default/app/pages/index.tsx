import type { Metadata } from '@devlusoft/devix'

export const metadata: Metadata = {
  title: 'Mi app devix',
  description: 'Creada con devix',
}

export default function Home() {
  return (
    <main>
      <h1>¡Hola devix!</h1>
      <p>Edita <code>app/pages/index.tsx</code> para empezar.</p>
    </main>
  )
}
