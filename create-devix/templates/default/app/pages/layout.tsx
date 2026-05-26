import type { RootLayoutProps } from '@devlusoft/devix'

export const lang = 'es'

export default function RootLayout(props: RootLayoutProps) {
  return (
    <html lang={props.lang}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {props.assets}
      </head>
      <body>
        {props.children}
        {props.scripts}
      </body>
    </html>
  )
}
