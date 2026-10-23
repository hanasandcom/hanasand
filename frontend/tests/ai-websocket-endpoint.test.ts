import { expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'

function configuredClientWebsocket(aiWebsocket?: string) {
    const script = 'globalThis.window = { location: { hostname: "hanasand.com", protocol: "https:" } }; const {default: config} = await import("./src/config.ts"); console.log(config.url.api_client_wss)'
    const result = Bun.spawnSync([process.execPath, '-e', script], {
        cwd: import.meta.dir + '/..',
        env: {
            ...process.env,
            NODE_ENV: 'production',
            NEXT_PUBLIC_API: 'https://app.example.test/api',
            ...(aiWebsocket ? { NEXT_PUBLIC_AI_API_WS: aiWebsocket } : {}),
        },
    })
    expect(result.exitCode).toBe(0)
    return result.stdout.toString().trim()
}

test('AI client WebSocket can use its own endpoint while REST stays on the app API', () => {
    expect(configuredClientWebsocket('ws://127.0.0.1:8389/api')).toBe('ws://127.0.0.1:8389/api')
    expect(configuredClientWebsocket()).toBe('wss://app.example.test/api')
})

test('Docker build forwards the AI WebSocket endpoint into the Next.js build', async () => {
    const dockerfile = await readFile(new URL('../Dockerfile', import.meta.url), 'utf8')
    expect(dockerfile).toContain('ARG NEXT_PUBLIC_AI_API_WS=')
    expect(dockerfile).toContain('ENV NEXT_PUBLIC_AI_API_WS=$NEXT_PUBLIC_AI_API_WS')

    const stagingCompose = await readFile(new URL('../../docker-compose.staging.yml', import.meta.url), 'utf8')
    expect(stagingCompose).toContain('NEXT_PUBLIC_AI_API_WS: ws://127.0.0.1:8389/api')
})
