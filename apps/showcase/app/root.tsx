import type { DevixRootProps } from '@devlusoft/devix'
import './app.css'

export default function Root(props: DevixRootProps) {
  return (
    <html lang="en">
      <head>
        {props.assets}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body class="bg-gray-50 text-gray-900 antialiased">
        {props.children}
        {props.scripts}
      </body>
    </html>
  )
}
