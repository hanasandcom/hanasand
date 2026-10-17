import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const defaultVersion = '0.1.1'
const defaultUpdateDirectory = '/srv/hanasand/app-updates'

type DesktopUpdateManifest = {
    version?: string
    package?: string
    notes?: string
    channel?: string
    released_at?: string
    releasedAt?: string
}

export type TauriUpdateManifest = {
    version?: string
    notes?: string
    pub_date?: string
    platforms?: Record<string, {
        signature?: string
        url?: string
    }>
}

export function updateDirectory() {
    return process.env.HANASAND_APP_UPDATE_DIR || defaultUpdateDirectory
}

export async function configuredUpdate() {
    const [manifest, tauriManifest] = await Promise.all([
        readUpdateManifest().catch(() => null),
        readTauriUpdateManifest().catch(() => null),
    ])
    const manifestPackage = manifest?.package
        ? path.resolve(updateDirectory(), manifest.package)
        : ''
    const tauriPackage = firstTauriPackagePath(tauriManifest)
    const filePath = process.env.HANASAND_APP_UPDATE_FILE || manifestPackage || tauriPackage
    const file = await fileMetadata(filePath).catch(() => null)
    const version = process.env.HANASAND_APP_VERSION || manifest?.version || tauriManifest?.version || defaultVersion

    return {
        file,
        version,
        channel: process.env.HANASAND_APP_CHANNEL || manifest?.channel || 'stable',
        releasedAt: process.env.HANASAND_APP_RELEASED_AT || manifest?.released_at || manifest?.releasedAt || tauriManifest?.pub_date || new Date().toISOString(),
        notes: process.env.HANASAND_APP_RELEASE_NOTES || manifest?.notes || tauriManifest?.notes || 'Desktop app update from the Hanasand API.',
        tauriManifest,
    }
}

export function firstTauriPlatform(manifest?: TauriUpdateManifest | null) {
    const platforms = manifest?.platforms
    if (!platforms) return null
    return Object.values(platforms)[0] || null
}

async function readUpdateManifest() {
    const data = await readFile(path.join(updateDirectory(), 'manifest.json'), 'utf8')
    return JSON.parse(data) as DesktopUpdateManifest
}

async function readTauriUpdateManifest() {
    const data = await readFile(path.join(updateDirectory(), 'latest.json'), 'utf8')
    return JSON.parse(data) as TauriUpdateManifest
}

function firstTauriPackagePath(manifest: TauriUpdateManifest | null) {
    const platforms = manifest?.platforms
    if (!platforms) return ''

    for (const platform of Object.values(platforms)) {
        const packageName = packageNameFromURL(platform.url)
        if (packageName) return path.resolve(updateDirectory(), packageName)
    }

    return ''
}

function packageNameFromURL(rawURL?: string) {
    if (!rawURL) return ''
    try {
        return path.basename(new URL(rawURL).pathname)
    } catch {
        return path.basename(rawURL)
    }
}

export async function fileMetadata(filePath: string) {
    if (!filePath) return null
    const absolute = path.resolve(filePath)
    const [info, bytes] = await Promise.all([stat(absolute), readFile(absolute)])
    return {
        absolute,
        size: info.size,
        sha256: createHash('sha256').update(bytes).digest('hex'),
    }
}
