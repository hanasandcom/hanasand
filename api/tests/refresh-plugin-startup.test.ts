import { expect, mock, test } from 'bun:test'

mock.module('../src/utils/backgroundJobRuntime.ts', () => ({
    runTrackedBackgroundJob: async () => new Promise<void>(() => {}),
}))
mock.module('../src/utils/refresh/queries/stats.ts', () => ({ default: async () => ({ data: {} }) }))
mock.module('../src/utils/refresh/queries/docker.ts', () => ({ default: async () => ({ data: {} }) }))
mock.module('../src/utils/refresh/queries/systemVms.ts', () => ({ default: async () => ({}) }))

const Fastify = (await import('fastify')).default
const { default: refreshPlugin } = await import('../src/utils/refresh/fp.ts')

test('host cache refresh does not gate Fastify startup', async () => {
    const app = Fastify({ pluginTimeout: 25 })
    app.register(refreshPlugin)

    await app.ready()
    expect(app.printPlugins()).toContain('fp-auto-0')
    await app.close()
})
