import { useParams } from '@solidjs/router'

export default function BlogPost() {
  const params = useParams<{ slug: string }>()
  return (
    <article>
      <h3>Post: {params.slug}</h3>
      <p>This page lives at /blog/:slug and the layout above wraps it.</p>
    </article>
  )
}
