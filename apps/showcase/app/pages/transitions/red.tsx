import { A } from '@solidjs/router'

export default function Red() {
  return (
    <main
      style={{
        'min-height': '60vh',
        'background-color': '#e53935',
        color: 'white',
        padding: '2rem',
      }}
    >
      <h1 style={{ 'view-transition-name': 'page-title' }}>Red page</h1>
      <p>
        Click the link to crossfade into blue. The title uses{' '}
        <code>view-transition-name: page-title</code> on both pages so it morphs rather than fades.
      </p>
      <p>
        <A href="/transitions/blue">→ Go to blue</A>
        {' · '}
        <A href="/">← Home</A>
      </p>
    </main>
  )
}
