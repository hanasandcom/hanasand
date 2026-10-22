import { expect, mock, test } from 'bun:test'

let completion = '{"summary":"A Node site with a database","services":["nodejs","postgresql"],"packages":["npm","psql","postgresql","ripgrep"],"website":null,"minecraftServerType":null}'
let completionRequests = 0
let completionMessages: Array<{ role: string, content: string }> = []
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async (req: any) => ({ valid: Boolean(req.headers.id), id: req.headers.id }) }))
mock.module('../src/utils/ai/client.ts', () => ({ requestAiCompletion: async (messages: Array<{ role: string, content: string }>) => { completionRequests += 1; completionMessages = messages; return completion } }))

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
    expect(result.json()).toEqual({ summary: 'A Node site with a database', services: ['nodejs', 'postgresql'], packages: ['ripgrep'], website: null, minecraftServerType: null })

    completion = JSON.stringify({ summary: 'Go API with PHP tools and data stores', services: ['go', 'php', 'mysql', 'sqlite'], packages: ['ripgrep', 'golang-go', 'php-cli', 'default-mysql-server', 'sqlite3'], website: null, minecraftServerType: null })
    const commonServices = await app.inject({ method: 'POST', url: '/vm/setup-plan', headers: { id: 'user' }, payload: { prompt: 'A Go API with PHP tools and data stores' } })
    expect(commonServices.statusCode).toBe(200)
    expect(commonServices.json().services).toEqual(['go', 'php', 'mysql', 'sqlite'])
    expect(commonServices.json().packages).toEqual(['ripgrep'])

    completion = JSON.stringify({ summary: 'A small bakery website', services: ['website', 'nginx'], packages: ['git', 'nginx', 'nodejs'], website: { title: '<script>alert(1)</script>', tagline: 'Fresh bread daily', sections: [{ heading: 'Visit us', body: 'Open every day.' }], gallery: [{ url: 'https://images.example/bread.jpg', alt: 'Freshly baked sourdough', caption: 'Baked this morning' }], contactEmail: 'bakery@example.com' }, minecraftServerType: null })
    const website = await app.inject({ method: 'POST', url: '/vm/setup-plan', headers: { id: 'user' }, payload: { prompt: 'A bakery website' } })
    expect(website.statusCode).toBe(200)
    expect(website.json().website.title).toBe('<script>alert(1)</script>')
    expect(website.json().website.gallery).toEqual([{ url: 'https://images.example/bread.jpg', alt: 'Freshly baked sourdough', caption: 'Baked this morning' }])
    expect(website.json().website.contactEmail).toBe('bakery@example.com')
    expect(website.json().packages).toEqual(['git'])
    expect(completionMessages[0].content).toContain('For a static website, include website and nginx only')
    expect(completionMessages[0].content).toContain('Contact email creates a mailto link, not a form')

    completion = JSON.stringify({ summary: 'A gallery page', services: ['website', 'nginx'], packages: [], website: { title: 'Gallery', tagline: '', sections: [], gallery: [{ url: 'javascript:alert(1)', alt: 'Unsafe', caption: '' }], contactEmail: '' }, minecraftServerType: null })
    const invalidGallery = await app.inject({ method: 'POST', url: '/vm/setup-plan', headers: { id: 'user' }, payload: { prompt: 'A photo gallery' } })
    expect(invalidGallery.statusCode).toBe(503)

    completion = JSON.stringify({ summary: 'A modded Java server', services: ['minecraft-java'], website: null, minecraftServerType: 'NEOFORGE' })
    const game = await app.inject({ method: 'POST', url: '/vm/setup-plan', headers: { id: 'user' }, payload: { prompt: 'A Fabric Minecraft server' } })
    expect(game.statusCode).toBe(200)
    expect(game.json().minecraftServerType).toBe('FABRIC')

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

test('custom web app requests return validated source and a server-owned runtime manifest', async () => {
    completion = JSON.stringify({
        summary: 'A private task board that saves items in this browser.',
        services: [],
        packages: [],
        website: null,
        minecraftServerType: null,
        projectFiles: [
            { path: 'src/app/page.jsx', content: 'export default function Page(){return <main>Task board</main>}' },
            { path: 'src/app/layout.jsx', content: 'export default function Layout({children}){return <html><body>{children}</body></html>}' },
            { path: 'src/app/globals.css', content: 'body { font-family: sans-serif; }' },
        ],
    })
    const result = await app.inject({ method: 'POST', url: '/vm/setup-plan', headers: { id: 'user' }, payload: { prompt: 'Build an interactive task board' } })
    expect(result.statusCode).toBe(200)
    expect(result.json().services).toEqual(['nodejs'])
    expect(result.json().projectFiles).toHaveLength(4)
    const packageJson = JSON.parse(result.json().projectFiles.find((file: { path: string }) => file.path === 'package.json').content)
    expect(packageJson.dependencies).toEqual({ next: '16.2.4', react: '19.2.5', 'react-dom': '19.2.5' })
    expect(packageJson.scripts).toEqual({ build: 'next build', start: 'next start --hostname 0.0.0.0 --port 3000' })
    expect(completionMessages[0].content).toContain('Do not return package.json; the server adds a fixed manifest')

    completion = JSON.stringify({
        summary: 'Unsafe app', services: ['nodejs'], packages: [], website: null, minecraftServerType: null,
        projectFiles: [
            { path: 'src/app/page.jsx', content: 'export default function Page(){return null}' },
            { path: 'src/app/layout.jsx', content: 'export default function Layout({children}){return <html><body>{children}</body></html>}' },
            { path: 'next.config.js', content: 'require("child_process").execSync("id")' },
        ],
    })
    const rejected = await app.inject({ method: 'POST', url: '/vm/setup-plan', headers: { id: 'user' }, payload: { prompt: 'Build an interactive task board' } })
    expect(rejected.statusCode).toBe(503)
})

test('an empty AI plan cannot be used to create a blank VM silently', async () => {
    completion = JSON.stringify({ summary: 'This custom request is not supported yet.', services: [], packages: [], website: null, minecraftServerType: null })
    const emptyPlan = await app.inject({ method: 'POST', url: '/vm/setup-plan', headers: { id: 'user' }, payload: { prompt: 'Install a custom app' } })
    expect(emptyPlan.statusCode).toBe(422)
    expect(emptyPlan.json()).toEqual({ error: 'This custom request is not supported yet.' })
})
