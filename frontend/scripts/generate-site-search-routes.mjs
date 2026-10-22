import { readFile, readdir, rm, rmdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertGeneratedOutputLineCap } from './generatedOutputLineCap.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.resolve(scriptDir, '..')
const appDir = path.join(frontendDir, 'src/app')
const outputPath = path.join(frontendDir, 'src/utils/routes/generatedSearchRoutes.ts')
const chunksDir = path.join(frontendDir, 'src/utils/routes/generatedSearchRoutes')
const generatedMarker = '// Generated from static App Router page files by scripts/generate-site-search-routes.mjs.'
const appRoutes = JSON.parse(await readFile(path.join(frontendDir, 'src/utils/routes/appRoutes.json'), 'utf8'))

async function pageRoutes(directory, segments = []) {
    const entries = await readdir(directory, { withFileTypes: true })
    const routes = []

    if (entries.some(entry => entry.isFile() && /^page\.(tsx|jsx|ts|js)$/.test(entry.name))
        && !segments.some(segment => segment.startsWith('[') && segment.endsWith(']'))) {
        routes.push('/' + segments.join('/'))
    }

    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('@')) continue
        const nextSegments = entry.name.startsWith('(') && entry.name.endsWith(')') ? segments : [...segments, entry.name]
        routes.push(...await pageRoutes(path.join(directory, entry.name), nextSegments))
    }

    return routes
}

function labelFor(route) {
    if (route === '/') return 'Home'
    return route.split('/').filter(Boolean).map(segment => segment
        .replace(/[-_]/g, ' ')
        .replace(/\b[a-z]/g, character => character.toUpperCase())
    ).join(' · ')
}

function quote(value) {
    const apostrophe = String.fromCharCode(39)
    const escaped = JSON.stringify(value).slice(1, -1)
        .replaceAll('\\"', '"')
        .replaceAll(apostrophe, '\\' + apostrophe)
        .replaceAll('\u2028', '\\u2028')
        .replaceAll('\u2029', '\\u2029')
    return apostrophe + escaped + apostrophe
}

const nonSearchableRoutes = new Set(['/prompt', '/dashboard/system/ssh-keys'])
const profilePagePath = appRoutes.find(([, canonical]) => canonical === '/ti/profiles')?.[0]
const watchlistsPagePath = appRoutes.find(([legacy]) => legacy === '/dashboard/findings/watchlists')?.[0]
const routes = [...new Set((await pageRoutes(appDir))
    .filter(route => !nonSearchableRoutes.has(route))
    .map(route => route === profilePagePath ? '/ti/profiles' : route === watchlistsPagePath ? '/watchlists' : route))].sort((a, b) => a.localeCompare(b))
const items = routes.map(href => `    { id: ${quote(`route:${href}`)}, title: ${quote(labelFor(href))}, detail: ${quote(href === '/' ? 'Overview and product entry point' : `Page · ${href}`)}, href: ${quote(href)} },`)
const content = `${generatedMarker}\nexport const generatedSearchRoutes = [\n${items.join('\n')}\n] as const\n`

assertGeneratedOutputLineCap(content, path.relative(frontendDir, outputPath))
await removeGeneratedChunks()

await writeFile(outputPath, content)

async function removeGeneratedChunks() {
    let names
    try {
        names = await readdir(chunksDir)
    } catch (error) {
        if (error.code === 'ENOENT') return
        throw error
    }

    for (const name of names) {
        if (!/^routeChunk-\d{3}\.ts$/.test(name)) continue
        const chunkPath = path.join(chunksDir, name)
        const chunk = await readFile(chunkPath, 'utf8')
        if (chunk.startsWith(generatedMarker)) await rm(chunkPath)
    }

    if ((await readdir(chunksDir)).length === 0) await rmdir(chunksDir)
}
