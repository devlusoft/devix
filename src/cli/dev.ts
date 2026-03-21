import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

while (true) {
    const result = spawnSync(process.execPath, [resolve(__dirname, 'dev-server.js')], {
        stdio: 'inherit',
        env: process.env,
    })
    if (result.status !== 75) break
}

export { }