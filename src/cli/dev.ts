import { spawnSync } from "node:child_process";

while (true) {
    const result = spawnSync(process.execPath, ['./devix-dev-server.js'], {
        stdio: 'inherit',
        env: process.env,
    })
    if (result.status !== 75) break
}