#!/usr/bin/env node
import {createJiti} from "jiti";

const jiti = createJiti(import.meta.url)
const { parseCommand } = await jiti.import('../lib/cli/index.ts')
const cmd = parseCommand(process.argv.slice(2))

if (cmd === "dev") {
    const {dev} = await jiti.import('../lib/cli/dev.ts')
    await dev()
} else if (cmd === "start") {
    const {start} = await jiti.import('../lib/cli/start.ts')
    await start()
} else {
    const {build} = await jiti.import('../lib/cli/build.ts')
    await build()
}
