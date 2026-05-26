import { createServer as createViteServer } from 'vite'
import { c, spinner } from '@nijil71/lumi-cli'
import { devix } from '../vite'
import { printDevBanner } from "../utils/banner"
import { loadConfig } from "../utils/load-config"
import { devixLog } from "../utils/log"

const devStartTime = Date.now()
const boot = spinner({ type: 'bounce' }).start('devix')
const viteLogOnce = new Set<string>()

boot.setText('Loading config...')
const config = await loadConfig(process.cwd(), 'development')
const port = Number(process.env.PORT) || config.port || 3000
const host = typeof config.host === 'string' ? config.host : config.host ? '0.0.0.0' : 'localhost'

boot.setText('Initializing Vite...')
const vite = await createViteServer({
    ...devix(config),
    configFile: false,
    server: {port, host},
    customLogger: {
        info: (msg) => devixLog.info(msg),
        warn: (msg) => devixLog.warn(msg),
        warnOnce: (msg) => {
            if (!viteLogOnce.has(msg)) {
                viteLogOnce.add(msg)
                devixLog.warn(msg)
            }
        },
        error: (msg) => devixLog.error(msg),
        clearScreen: () => {},
        hasErrorLogged: () => false,
        hasWarned: false,
    },
})

await vite.listen()
boot.stop()
printDevBanner(port, devStartTime)

export {}
