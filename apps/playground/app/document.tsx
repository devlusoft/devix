import type { ParentProps } from 'solid-js'

export default function Document(props: ParentProps) {
  return (
    <html lang="es">
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1"/>
      <title>devix playground</title>
    </head>
    <body>{props.children}</body>
    </html>
  )
}