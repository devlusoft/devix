import type { JSX } from 'solid-js'

export default function Root(props: { children?: JSX.Element }) {
  return (
    <html lang="en">
      <head>
        <title>Devix Showcase</title>
      </head>
      <body>{props.children}</body>
    </html>
  )
}
