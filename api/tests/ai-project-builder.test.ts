import { createHash } from 'node:crypto'
import { expect, test } from 'bun:test'
import { buildShareProjectResponse } from '../src/handlers/tools/aiProjectBuilder.ts'

function generatedFiles(message: string) {
    return [...message.matchAll(/<hanasand-tool>(.*?)<\/hanasand-tool>/gs)]
        .map(([, value]) => JSON.parse(value!) as { action: string; path: string; content: string })
}

test('builder generates runnable website files and caches an identical response', () => {
    expect(buildShareProjectResponse('Hello there')).toBeNull()

    const prompt = 'Build a small website called "Moon Archive" with Docker'
    const first = buildShareProjectResponse(prompt)!
    const files = generatedFiles(first.message)

    expect(first).toMatchObject({
        status: 'completed',
        provider: 'hanasand-ai',
        model: 'share-builder',
        cache: { hit: false, category: 'deployment_fix' },
    })
    expect(files.map(file => file.path)).toContain('package.json')
    expect(files.map(file => file.path)).toContain('Dockerfile')
    expect(files.map(file => file.path)).toContain('src/app/page.tsx')
    expect(files.every(file => file.action === 'upsert_share')).toBe(true)
    expect(files.find(file => file.path === 'package.json')?.content).toContain('"next"')
    expect(first.message).toContain('Prepared a runnable product website')

    const apiFiles = generatedFiles(buildShareProjectResponse('Build a Fastify API called "Orbit Ledger"')!.message)
    expect(apiFiles.find(file => file.path === 'src/db.ts')?.content).toContain('export async function checkDatabase()')

    const second = buildShareProjectResponse(prompt)!
    expect(second.message).toBe(first.message)
    expect(second.cache).toEqual({ ...first.cache, hit: true })
})

test('shared project setup keeps generated output unchanged across project types', () => {
    const cases = [
        ['Build a small website called "Moon Archive" with Docker', '6ce31ecf943c3d1dbfb6067526d4a3c97ea62c1b3039c5d4d538226ff6a18c3a'],
        ['Build a Fastify API called "Orbit Ledger"', '1c8df11bd335bf94e81b272c804effda0f0071e34c31bf61d633104a2659c46d'],
        ['Build a Discord bot called "Signal Keeper"', '070f7dd20dddaaee76a0aace5949263fcb242a93940ec884a8ca550269772861'],
        ['Build a background worker queue called "Media Runner"', '26923e5ee3e89d54ad14985ec8cb69c8762541b3d6a4ab846a5bd50affe6e83c'],
    ] as const

    for (const [prompt, expectedHash] of cases) {
        const response = buildShareProjectResponse(prompt)!
        const actualHash = createHash('sha256').update(response.message).digest('hex')
        expect(actualHash, prompt).toBe(expectedHash)
    }
})
