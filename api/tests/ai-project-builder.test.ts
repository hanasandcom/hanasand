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

test('mutating a returned response does not alter its cached copy', () => {
    const prompt = 'Build a website called "Cache Integrity Garden"'
    const first = buildShareProjectResponse(prompt)!
    const originalMessage = first.message
    const originalCache = { ...first.cache! }

    first.message = 'caller mutation'
    first.cache!.key = 'caller mutation'

    const second = buildShareProjectResponse(prompt)!
    expect(second.message).toBe(originalMessage)
    expect(second.cache).toEqual({ ...originalCache, hit: true })
})

test('different prompts with the same project name do not share an incomplete cache key', () => {
    const generalClinic = buildShareProjectResponse('Build a website for a healthcare clinic called "Collision Clinic"')!
    const recallClinic = buildShareProjectResponse('Build a website for a healthcare clinic pharmacy recall called "Collision Clinic"')!

    expect(generalClinic.message).toContain('Beginner deployment')
    expect(generalClinic.message).not.toContain('Recall checklist')
    expect(recallClinic.message).toContain('Recall checklist')
    expect(recallClinic.cache?.hit).toBe(false)
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

test('shared section presets keep generated output unchanged', () => {
    const cases = [
        ['Build a returns portal website', '32167e6817ff54ba608582f225a0b40b9b33ad03aeb62f2db6eb6a3598d67623', 'Return sections'],
        ['Build a website for a municipal service portal with snow closure notices', 'aeea1271adc4af5fbb00edbe53fdfd5405d964e65bc9e0cb7c3433745e3c94cc', 'Response metrics'],
        ['Build a website for a food pantry', '2a92cf2ddc46ad07f0e692e26597ef25407a6d4833c62fdcc70e96e62b078440', 'Mobile release'],
        ['Build a website for lost baggage claims', '1e865b37f2ddd9d5553209c433985eb2b45ac9cbffec0a5726c25ca43428c3fd', 'Customer quotes'],
        ['Build a website for field service dispatch', '667688a3c1c7872afbb20d5d0c0b24e3d50f9092c001b3564431a320f471fb87', 'Pricing cards'],
        ['Build a gallery website for an image review queue', 'd10552413bc32b7f763af62e514a85efbedfadfd0bc6485d577b01acdcff66dd', 'Deferred deletion confirmation'],
    ] as const

    for (const [prompt, expectedHash, expectedSection] of cases) {
        const response = buildShareProjectResponse(prompt)!
        const actualHash = createHash('sha256').update(response.message).digest('hex')
        expect(actualHash, prompt).toBe(expectedHash)
        expect(response.message, prompt).toContain(expectedSection)
    }
})

test('ordered section rules preserve overlaps and matcher boundaries', () => {
    const cases = [
        ['Build a website for a municipal permit residents angry about a municipal service portal', '04ea746b2e51afd310c1fd35a515ff60a8e78a2636793b6442481c356f3edb10', 'Permit categories'],
        ['Build a website for a healthcare clinic pharmacy recall', '92c2b4815ff64599e7e68e417e0f9c837bc39e1c3c38fa60d7ae10bed6f1de92', 'Recall checklist'],
        ['Build a website for restaurant allergy recall reservations', '055121110b1a5c568917ea0f7c86c6998faa92e1cadc2f7ff288afd90455bffb', 'Mobile release'],
        ['Build a website for storm repair dispatch accessibility', '10b0fe826baff93d87a3395cabb9c80fe34df923438b17306a54a522f2056d2e', 'Mobile release'],
        ['Build a website for rural internet outage signup', '16e3f8d449c150da0caa2553d77162e622ad7deb67b3a2267d2febb0ec633885', 'Mobile release'],
        ['Build an artist drop website for releasing prints', '64d7344db3383633b1156e54b77856ad78621052f43727796e8e28fe26d5a0da', 'Product bundles'],
        ['Build an architecture showcase website', 'd3316ce2768805347dc430de6ba64aee86088aed9fcd7976bfc51f87f7fd6fc8', 'Delivery tasks'],
        ['Build a municipal service portal website with deployment notes', 'dc2b993a8d70b64e0e4b7d64f4b4ac63e9a93bbc71b6a87b07fd8e5fcf9ac9c7', 'Resident quotes'],
        ['Build a website for design delivery component groups', 'f23f660c06f0c1d190bc97b2c5a25d8fa11538007bae997d9f746524bc1ad5c0', 'Scope and pricing'],
        ['Build an ecommerce checkout for failed payment recovery', 'c03382f04fd7c46cd5932470c5cdf174032ac910c78501785183588cdbf1000b', 'Shipping notes'],
        ['Build a creator membership checkout website', 'a908a5cdb5f8672ea6ef92381598289ac2845a490460449130b1d4c86b1d54f7', 'Member benefits'],
        ['Build a website for support bundle privacy', '4ef61ea5984fdd9cf18786c64f1a4e585dc692d7d9c463b5b64d6780b77101de', 'Data map'],
        ['Build a website for support escalation', '41a31db9719cae0490a033e44058df4c446cecd95e74c8fbe98ceface15b9a02', 'Escalation paths'],
        ['Build a website for knowledge base support', 'eb66c7ae18aeaa4d20f67b741befe6f434d3b3baf583d9af41da2f4343752718', 'Quickstart'],
        ['Build a website for rollback backend contract', '100a992a8bb2276b4d1368294ddddc15d9fbf18ab93fbf455b3af25bc761b780', 'Backend contract'],
        ['Build a website for rollback mobile refresh', '354d844d4c32b77153300c81779d7ce1a7dfaa2a90fa790ed2944e865c55e971', 'Backend contract'],
        ['Build a website for services', '8be504a9ea4c57ddedaf63f582fd2a45c88d89dc20a6d69668d4119d6c2fa8f6', 'Services'],
        ['Build a website for microservices', '98b6988aad6a70a36d39d340992e568fe2f42c9078a3c60068d7a1fb3e926129', 'Overview'],
        ['Build a simple site', '46cb59f45a30b8f329dad728d4617dc05f383e40b599d028beffdbf58556488e', 'Overview'],
        ['Build a website for ecommerceX checkoutX', 'bc1c213382bcf39c33d5d8743deb6b44658d713290944d7ac8ee65e96b1ddaa3', 'Overview'],
    ] as const

    for (const [prompt, expectedHash, expectedSection] of cases) {
        const response = buildShareProjectResponse(prompt)!
        const actualHash = createHash('sha256').update(response.message).digest('hex')
        expect(actualHash, prompt).toBe(expectedHash)
        expect(response.message, prompt).toContain(expectedSection)
    }
})

test('website-specific DNS sections do not leak into later prompts', () => {
    const withDns = buildShareProjectResponse('Build a website called "Harbor Portal" with DNS')!
    const withoutDns = buildShareProjectResponse('Build a website called "Harbor Portal"')!

    expect(withDns.message).toContain('DNS checklist')
    expect(withoutDns.message).not.toContain('DNS checklist')
})
