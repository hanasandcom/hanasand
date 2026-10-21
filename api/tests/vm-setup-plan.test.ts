import { expect, mock, test } from 'bun:test'

let completion = '{"summary":"A Node site with a database","services":["nodejs","postgresql"],"website":null,"minecraftServerType":null}'
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async (req: any) => ({ valid: Boolean(req.headers.id), id: req.headers.id }) }))
mock.module('../src/utils/ai/client.ts', () => ({ requestAiCompletion: async () => completion }))

const { default: Fastify } = await import('fastify')
const { default: postVmSetupPlan } = await import('../src/handlers/vms/postSetupPlan.ts')
const app = Fastify()
app.post('/vm/setup-plan', postVmSetupPlan)

test('VM setup suggestions require a signed-in user and a bounded prompt', async () => {
    expect((await app.inject({ method: 'POST', url: '/vm/setup-plan', payload: { prompt: 'A small website' } })).statusCode).toBe(401)
    const short = await app.inject({ method: 'POST', url: '/vm/setup-plan', headers: { id: 'user' }, payload: { prompt: 'no' } })
    const long = await app.inject({ method: 'POST', url: '/vm/setup-plan', headers: { id: 'user' }, payload: { prompt: 'a'.repeat(1201) } })
    expect(short.statusCode).toBe(400)
    expect(long.statusCode).toBe(400)
})

test('VM setup suggestions return only allowlisted services', async () => {
    const result = await app.inject({ method: 'POST', url: '/vm/setup-plan', headers: { id: 'user' }, payload: { prompt: 'A small website with a database' } })
    expect(result.statusCode).toBe(200)
    expect(result.json()).toEqual({ summary: 'A Node site with a database', services: ['nodejs', 'postgresql'], website: null, minecraftServerType: null })

    completion = JSON.stringify({ summary: 'A small bakery website', services: ['website', 'nginx'], website: { title: '<script>alert(1)</script>', tagline: 'Fresh bread daily', sections: [{ heading: 'Visit us', body: 'Open every day.' }] }, minecraftServerType: null })
    const website = await app.inject({ method: 'POST', url: '/vm/setup-plan', headers: { id: 'user' }, payload: { prompt: 'A bakery website' } })
    expect(website.statusCode).toBe(200)
    expect(website.json().website.title).toBe('<script>alert(1)</script>')

    completion = JSON.stringify({ summary: 'A modded Java server', services: ['minecraft-java'], website: null, minecraftServerType: 'NEOFORGE' })
    const game = await app.inject({ method: 'POST', url: '/vm/setup-plan', headers: { id: 'user' }, payload: { prompt: 'A Fabric Minecraft server' } })
    expect(game.statusCode).toBe(200)
    expect(game.json().minecraftServerType).toBe('NEOFORGE')

    completion = '{"summary":"Run this shell command","services":["unknown"],"website":null,"minecraftServerType":null}'
    const unsupported = await app.inject({ method: 'POST', url: '/vm/setup-plan', headers: { id: 'user' }, payload: { prompt: 'Something custom' } })
    expect(unsupported.statusCode).toBe(503)
    expect(unsupported.json()).toEqual({ error: 'Could not turn that request into a supported setup. Choose services from the list or try again.' })
})
