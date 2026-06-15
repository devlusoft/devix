import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from '@devlusoft/devix'

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
})
