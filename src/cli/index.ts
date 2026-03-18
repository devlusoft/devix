#!/usr/bin/env node
import {readFileSync} from 'node:fs'
import {join, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const command = process.argv[2]

switch (command) {
    case 'dev':
        await import("./dev.js")
        break
    case "build":
        await import("./build.js")
        break
    case "generate":
        await import("./generate.js")
        break
    case "start":
        await import("./start.js")
        break
    case '--version':
    case '-v': {
        const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf-8'))
        console.log(pkg.version)
        break
    }
    case '--help':
    case '-h':
        console.log(`
devix — a lightweight SSR framework

Usage:
  devix dev        Start development server
  devix build      Build for production
  devix generate   Build and generate static HTML (SSG)
  devix start      Start production server

Options:
  -v, --version  Show version
  -h, --help     Show this help

Output modes (set in devix.config.ts):
  output: "server"   SSR mode — devix start handles requests dynamically (default)
  output: "static"   SSG mode — devix generate pre-renders all pages; devix start serves static files only
        `.trim())
        break
    default:
        console.error(`Unknown command: ${command}`)
        console.error('Usage: devix <dev|build|generate|start>')
        process.exit(1)
}

export {}