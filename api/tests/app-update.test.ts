import { afterAll, beforeAll, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import Fastify from 'fastify'
import { downloadAppUpdate, downloadNamedAppUpdate, getAppUpdate, getTauriAppUpdate } from '../src/handlers/app/get.ts'

const packageBytes = Buffer.from('desktop package contents')
const originalDirectory = process.env.HANASAND_APP_UPDATE_DIR
const overrideNames = ['HANASAND_APP_UPDATE_FILE', 'HANASAND_APP_VERSION', 'HANASAND_APP_CHANNEL', 'HANASAND_APP_RELEASED_AT', 'HANASAND_APP_RELEASE_NOTES', 'HANASAND_APP_UPDATE_SIGNATURE']
const originalOverrides = Object.fromEntries(overrideNames.map(name => [name, process.env[name]]))
let updateDirectory = ''
const app = Fastify({ logger: false })

app.get('/app', getAppUpdate)
app.get('/app/:target/:version', getTauriAppUpdate)
app.get('/app/download', downloadAppUpdate)
app.get('/app/download/:name', downloadNamedAppUpdate)

beforeAll(async () => {
    updateDirectory = await mkdtemp(path.join(os.tmpdir(), 'app-update-'))
    process.env.HANASAND_APP_UPDATE_DIR = updateDirectory
    for (const name of overrideNames) delete process.env[name]
    await writeFile(path.join(updateDirectory, 'Hanasand.dmg'), packageBytes)
    await writeFile(path.join(updateDirectory, 'latest.json'), JSON.stringify({
        version: '2.4.0',
        notes: 'Improved desktop startup.',
        pub_date: '2026-10-01T12:00:00.000Z',
        platforms: { 'darwin-aarch64': { signature: 'release-signature', url: 'https://updates.example/Hanasand.dmg' } },
    }))
})

afterAll(async () => {
    await app.close()
    if (originalDirectory === undefined) delete process.env.HANASAND_APP_UPDATE_DIR
    else process.env.HANASAND_APP_UPDATE_DIR = originalDirectory
    for (const name of overrideNames) {
        const value = originalOverrides[name]
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
    }
    if (updateDirectory) await rm(updateDirectory, { recursive: true, force: true })
})

test('update feeds and package downloads share manifest metadata and file hash', async () => {
    const desktop = await app.inject('/app?platform=macOS&version=2.3.0')
    expect(desktop.statusCode).toBe(200)
    expect(desktop.headers['cache-control']).toBe('no-store')
    expect(desktop.json()).toMatchObject({
        app: 'hanasand-desktop', platform: 'macos', installed_version: '2.3.0', latest_version: '2.4.0',
        update_available: true, channel: 'stable', released_at: '2026-10-01T12:00:00.000Z',
        notes: 'Improved desktop startup.', download_url: 'https://api.hanasand.com/api/app/download/Hanasand.dmg',
        package_size: packageBytes.length, sha256: createHash('sha256').update(packageBytes).digest('hex'),
    })

    const tauri = await app.inject('/app/darwin-aarch64/2.3.0')
    expect(tauri.statusCode).toBe(200)
    expect(tauri.json()).toEqual({
        version: '2.4.0', notes: 'Improved desktop startup.', pub_date: '2026-10-01T12:00:00.000Z',
        platforms: { 'darwin-aarch64': { signature: 'release-signature', url: 'https://api.hanasand.com/api/app/download/Hanasand.dmg' } },
    })

    const download = await app.inject('/app/download')
    expect(download.statusCode).toBe(200)
    expect(download.body).toBe(packageBytes.toString())
    expect(download.headers['x-hanasand-app-sha256']).toBe(createHash('sha256').update(packageBytes).digest('hex'))
    expect(download.headers['x-hanasand-app-version']).toBe('2.4.0')

    const namedDownload = await app.inject('/app/download/Hanasand.dmg')
    expect(namedDownload.statusCode).toBe(200)
    expect(namedDownload.body).toBe(packageBytes.toString())
})

test('update endpoints retain no-update and invalid package responses', async () => {
    const current = await app.inject('/app/darwin-aarch64/2.4.0')
    expect(current.statusCode).toBe(204)
    const invalid = {
        statusCode: 200,
        payload: undefined as unknown,
        status(code: number) { this.statusCode = code; return this },
        send(payload: unknown) { this.payload = payload; return this },
    }
    await downloadNamedAppUpdate({ params: { name: '../latest.json' } } as never, invalid as never)
    expect(invalid.statusCode).toBe(400)
    expect(invalid.payload).toEqual({ error: 'Invalid app update package name.' })
})

test('desktop manifest package and environment metadata precedence remain stable', async () => {
    const manifestPackage = Buffer.from('manifest package')
    await writeFile(path.join(updateDirectory, 'Manifest.dmg'), manifestPackage)
    await writeFile(path.join(updateDirectory, 'manifest.json'), JSON.stringify({
        package: 'Manifest.dmg', version: '1.0.0', channel: 'stable', released_at: '2026-09-01T00:00:00.000Z', notes: 'Manifest notes',
    }))
    process.env.HANASAND_APP_VERSION = '3.0.0'
    process.env.HANASAND_APP_CHANNEL = 'preview'
    process.env.HANASAND_APP_RELEASED_AT = '2026-10-10T00:00:00.000Z'
    process.env.HANASAND_APP_RELEASE_NOTES = 'Environment notes'
    try {
        const response = await app.inject('/app?version=2.9.0')
        expect(response.statusCode).toBe(200)
        expect(response.json()).toMatchObject({
            latest_version: '3.0.0', update_available: true, channel: 'preview',
            released_at: '2026-10-10T00:00:00.000Z', notes: 'Environment notes',
            download_url: 'https://api.hanasand.com/api/app/download/Manifest.dmg', package_size: manifestPackage.length,
            sha256: createHash('sha256').update(manifestPackage).digest('hex'),
        })
    } finally {
        for (const name of overrideNames) delete process.env[name]
    }

    const overridePackage = Buffer.from('environment-selected package')
    const overridePath = path.join(updateDirectory, 'Override.dmg')
    await writeFile(overridePath, overridePackage)
    process.env.HANASAND_APP_UPDATE_FILE = overridePath
    try {
        const response = await app.inject('/app')
        expect(response.statusCode).toBe(200)
        expect(response.json()).toMatchObject({
            download_url: 'https://api.hanasand.com/api/app/download/Override.dmg',
            package_size: overridePackage.length,
            sha256: createHash('sha256').update(overridePackage).digest('hex'),
        })
    } finally {
        delete process.env.HANASAND_APP_UPDATE_FILE
    }
})
