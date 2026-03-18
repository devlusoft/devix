import type { LayoutProps } from '@devlusoft/devix'

export const lang = 'es'

export default function RootLayout({ children }: LayoutProps) {
  return (
    <div>
      {children}
    </div>
  )
}
