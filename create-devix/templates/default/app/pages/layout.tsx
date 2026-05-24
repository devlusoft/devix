import type { LayoutProps } from '@devlusoft/devix'

export const lang = 'es'

export default function RootLayout(props: LayoutProps) {
  return (
    <div>
      {props.children}
    </div>
  )
}
