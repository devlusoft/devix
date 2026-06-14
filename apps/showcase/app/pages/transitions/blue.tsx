import { A } from '@solidjs/router'

export default function Blue() {
  return (
    <main
      style={{
        'min-height': '60vh',
        'background-color': '#1e88e5',
        color: 'white',
        padding: '2rem',
      }}
    >
      <h1 style={{ 'view-transition-name': 'page-title' }}>Blue page</h1>
      <p>
        Background crossfades from red to blue. The shared <code>view-transition-name</code> on the
        h1 keeps the title stable during the transition.
      </p>
      <p>
        <A href="/transitions/red">→ Back to red</A>
        {' · '}
        <A href="/">← Home</A>
      </p>
    </main>
  )
}
