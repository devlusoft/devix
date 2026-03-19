import {defineConfig} from 'vitest/config'
import react from "@vitejs/plugin-react";
import {resolve} from 'node:path'

export default defineConfig({
    plugins: [react()],
    test: {
        include: ["tests/**/*.test.{ts,tsx}"],
        alias: {
            'virtual:devix/context': resolve(__dirname, 'tests/__mocks__/virtual-context.ts'),
            'virtual:devix/client-routes': resolve(__dirname, 'tests/__mocks__/virtual-client-routes.ts'),
        },
    }
})