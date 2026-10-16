import { expect, test } from 'bun:test'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const apiDirectory = fileURLToPath(new URL('..', import.meta.url))
const fetchSentinel = 'PUBLIC_API_CONTRACT_FETCH_SENTINEL'

test('direct and package invocations require an explicit base and block remote targets before fetching', async () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'public-api-contract-guard-'))
    const preloadPath = join(temporaryDirectory, 'block-fetch.mjs')
    const bunShimPath = join(temporaryDirectory, 'bun')
    writeFileSync(preloadPath, `globalThis.fetch = async () => { console.error('${fetchSentinel}'); throw new Error('Unexpected fetch.') }`)
    writeFileSync(bunShimPath, `#!/bin/sh\nexec ${process.execPath} --preload ${preloadPath} "$@"\n`)
    chmodSync(bunShimPath, 0o755)

    try {
        for (const command of [
            ['scripts/validate-public-api-contract.ts'],
            ['run', 'smoke:public-api-contract'],
        ]) {
            const missingBase = await run(command, preloadPath, bunShimPath, { PUBLIC_API_BASE: '' })
            expect(missingBase.status).not.toBe(0)
            expect(missingBase.error).toContain('PUBLIC_API_BASE is required')
            expect(missingBase.error).not.toContain(fetchSentinel)

            const remoteTarget = await run(command, preloadPath, bunShimPath, { PUBLIC_API_BASE: 'https://api.hanasand.com/api/v1' })
            expect(remoteTarget.status).not.toBe(0)
            expect(remoteTarget.error).toContain('Refusing to run smoke/e2e scripts against production target')
            expect(remoteTarget.error).not.toContain(fetchSentinel)

            const allowedTarget = await run(command, preloadPath, bunShimPath, {
                PUBLIC_API_BASE: 'https://api.hanasand.com/api/v1',
                ALLOW_PRODUCTION_SMOKE: '1',
            })
            expect(allowedTarget.status).not.toBe(0)
            expect(allowedTarget.error).toContain(fetchSentinel)
            expect(allowedTarget.error).not.toContain('Refusing to run smoke/e2e scripts against production target')
        }
    } finally {
        rmSync(temporaryDirectory, { recursive: true, force: true })
    }
})

async function run(command: string[], preloadPath: string, bunShimPath: string, overrides: Record<string, string>) {
    const args = command[0] === 'run'
        ? [process.execPath, 'run', '--preload', preloadPath, ...command.slice(1)]
        : [process.execPath, '--preload', preloadPath, ...command]
    const child = Bun.spawn(args, {
        cwd: apiDirectory,
        env: {
            ...process.env,
            API_BASE: '',
            FRONTEND_BASE: '',
            NEXT_PUBLIC_API: '',
            MONITOR_API_BASE: '',
            NODE_ENV: 'test',
            ALLOW_PRODUCTION_SMOKE: '',
            PUBLIC_API_BASE: '',
            PUBLIC_API_KEY: 'test-only',
            PUBLIC_API_RATE_LIMIT_KEY: 'test-only',
            PATH: `${dirname(bunShimPath)}:${process.env.PATH ?? ''}`,
            ...overrides,
        },
        stdout: 'pipe',
        stderr: 'pipe',
    })
    const [status, output, error] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
    ])
    return { status, output, error }
}
