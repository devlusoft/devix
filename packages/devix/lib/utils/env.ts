import {loadEnv} from 'vite'

export function loadDotenv(mode: string) {
    const env = loadEnv(mode, process.cwd(), '')
    for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) {
            process.env[key] = value
        }
    }
}
