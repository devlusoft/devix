import type { DevixRootProps } from '@devlusoft/devix'

export default function Root(props: DevixRootProps) {
  return (
    <html lang="en">
      <head>
        {props.assets}
        <title>Devix Showcase</title>
      </head>
      <body>
        {props.children}
        {props.scripts}
      </body>
    </html>
  )
}
