import { expect, mock, test } from 'bun:test'

let completion = '{"summary":"A Node site with a database","services":["nodejs","postgresql"],"website":null,"minecraftServerType":null}'
let completionRequests = 0
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async (req: any) => ({ valid: Boolean(req.headers.id), id: req.headers.id }) }))
mock.module('../src/utils/ai/client.ts', () => ({ requestAiCompletion: async () => { completionRequests += 1; return completion } }))

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
    expect(result.json()).toEqual({ summary: 'A Node site with a database', services: ['nodejs', 'postgresql'], packages: [], website: null, minecraftServerType: null })

    completion = JSON.stringify({ summary: 'Go API with PHP tools and data stores', services: ['go', 'php', 'mysql', 'sqlite'], packages: ['ripgrep'], website: null, minecraftServerType: null })
    const commonServices = await app.inject({ method: 'POST', url: '/vm/setup-plan', headers: { id: 'user' }, payload: { prompt: 'A Go API with PHP tools and data stores' } })
    expect(commonServices.statusCode).toBe(200)
    expect(commonServices.json().services).toEqual(['go', 'php', 'mysql', 'sqlite'])
    expect(commonServices.json().packages).toEqual(['ripgrep'])

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

    completion = JSON.stringify({ summary: 'Run shell command', services: [], packages: ['; rm -rf /'], website: null, minecraftServerType: null })
    const unsafePackage = await app.inject({ method: 'POST', url: '/vm/setup-plan', headers: { id: 'user' }, payload: { prompt: 'Something custom' } })
    expect(unsafePackage.statusCode).toBe(503)
})

test('unsupported game requests cannot be remapped to Minecraft Java', async () => {
    const callsBefore = completionRequests
    const bedrock = await app.inject({ method: 'POST', url: '/vm/setup-plan', headers: { id: 'user' }, payload: { prompt: 'Set up a Minecraft Bedrock server' } })
    expect(bedrock.statusCode).toBe(422)
    expect(bedrock.json()).toEqual({ error: 'Minecraft Bedrock is not available yet. This VM builder currently supports Minecraft Java Edition.' })
    expect(completionRequests).toBe(callsBefore)

    completion = JSON.stringify({ summary: 'Terraria needs a separate UDP route.', unsupportedReason: 'This game server is not available yet.', services: [], packages: [], website: null, minecraftServerType: null })
    const unsupportedGame = await app.inject({ method: 'POST', url: '/vm/setup-plan', headers: { id: 'user' }, payload: { prompt: 'Set up a Terraria server' } })
    expect(unsupportedGame.statusCode).toBe(422)
    expect(unsupportedGame.json()).toEqual({ error: 'This game server is not available yet.' })
})

test('an empty AI plan cannot be used to create a blank VM silently', async () => {
    completion = JSON.stringify({ summary: 'This custom request is not supported yet.', services: [], packages: [], website: null, minecraftServerType: null })
    const emptyPlan = await app.inject({ method: 'POST', url: '/vm/setup-plan', headers: { id: 'user' }, payload: { prompt: 'Install a custom app' } })
    expect(emptyPlan.statusCode).toBe(422)
    expect(emptyPlan.json()).toEqual({ error: 'This custom request is not supported yet.' })
})
