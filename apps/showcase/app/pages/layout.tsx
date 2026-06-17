import type { LayoutProps } from '@devlusoft/devix'
import { Link } from '@devlusoft/devix'

export const lang = 'en'

export default function RootLayout({ children }: LayoutProps) {
  return (
    <div>
      <nav className="nav">
        <span className="brand">Devix Showcase</span>
        <Link href="/">Tasks</Link>
      </nav>
      {children}
    </div>
  )
}
