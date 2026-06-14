import type { RouteSectionProps } from '@solidjs/router'
import { A } from '@solidjs/router'

export default function BlogLayout(props: RouteSectionProps) {
  return (
    <section style={{ border: '2px dashed #888', padding: '1rem', margin: '1rem 0' }}>
      <header>
        <h2>Blog</h2>
        <nav>
          <A href="/blog">Index</A>
          <span> · </span>
          <A href="/blog/first-post">First post</A>
          <span> · </span>
          <A href="/blog/second-post">Second post</A>
        </nav>
      </header>
      <main>{props.children}</main>
    </section>
  )
}
