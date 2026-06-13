import type { UserConfig } from 'vite'
import solid from 'vite-plugin-solid'
import type { ResolvedDevixConfig } from '../config/define-config'
import { dataTransform } from '../data/vite-plugin'
import { router } from '../router/plugin'
import { devixServer } from '../server/plugin'

export function preset(config: ResolvedDevixConfig): UserConfig {
  return {
    plugins: [solid({ ssr: true }), router(), devixServer(), dataTransform()],
    appType: 'custom',
    build: { outDir: config.outDir },
    base: config.base,
    ssr: { noExternal: ['@devlusoft/devix'] },
  }
}
