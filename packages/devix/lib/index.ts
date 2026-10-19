import solid from '@solidjs/vite-plugin'
import type { Plugin } from 'vite'

export default function devix(): Plugin[] {
  return solid({
    start: {
      app: 'app/app.tsx',
      document: 'app/document.tsx'
    },
    ssr: true,
  })
}