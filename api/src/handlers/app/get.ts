import { createReadStream } from 'node:fs'
import path from 'node:path'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { configuredUpdate, fileMetadata, firstTauriPlatform, updateDirectory } from './updateFiles.ts'

const currentApiBase = process.env.HANASAND_APP_API_BASE || 'https://api.hanasand.com/api'

type AppQuery = {
    platform?: string
    version?: string
}

type AppDownloadQuery = {
    platform?: string
}

type TauriUpdateParams = {
    target: string
    version: string
}

type TauriDownloadParams = {
    name: string
}

function normalizePlatform(platform?: string) {
    return platform?.trim().toLowerCase() || 'macos'
}

function compareVersions(a: string, b: string) {
    if (a === b) return 0

    const leftIsNumeric = /^[0-9]+(?:[.-][0-9]+)*$/.test(a)
    const rightIsNumeric = /^[0-9]+(?:[.-][0-9]+)*$/.test(b)
    if (!leftIsNumeric || !rightIsNumeric) {
        return 1
    }

    const left = a.split(/[.-]/).map(part => Number.parseInt(part, 10) || 0)
    const right = b.split(/[.-]/).map(part => Number.parseInt(part, 10) || 0)
    const length = Math.max(left.length, right.length)
    for (let index = 0; index < length; index += 1) {
        const diff = (left[index] || 0) - (right[index] || 0)
        if (diff !== 0) return diff
    }
    return 0
}

function publicBaseURL() {
    return currentApiBase.replace(/\/$/, '')
}

export async function getAppUpdate(req: FastifyRequest<{ Querystring: AppQuery }>, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    const platform = normalizePlatform(req.query.platform)
    const installedVersion = req.query.version || '0.0.0'
    const update = await configuredUpdate()
    const version = update.version
    const file = update.file
    const updateAvailable = Boolean(file) && compareVersions(version, installedVersion) > 0

    return res.send({
        app: 'hanasand-desktop',
        platform,
        installed_version: installedVersion,
        latest_version: version,
        update_available: updateAvailable,
        channel: update.channel,
        released_at: update.releasedAt,
        notes: update.notes,
        download_url: file
            ? `${publicBaseURL()}/app/download/${encodeURIComponent(path.basename(file.absolute))}`
            : `${publicBaseURL()}/app/download?platform=${encodeURIComponent(platform)}`,
        package_size: file?.size || null,
        sha256: file?.sha256 || null,
    })
}

export async function getTauriAppUpdate(req: FastifyRequest<{ Params: TauriUpdateParams }>, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    const target = req.params.target || 'darwin-aarch64'
    const installedVersion = req.params.version || '0.0.0'
    const update = await configuredUpdate()
    const version = update.version
    const file = update.file

    if (!file || compareVersions(version, installedVersion) <= 0) {
        return res.status(204).send()
    }

    const artifactName = path.basename(file.absolute)
    const platformManifest = update.tauriManifest?.platforms?.[target] || firstTauriPlatform(update.tauriManifest)
    return res.send({
        version,
        notes: update.notes,
        pub_date: update.releasedAt,
        platforms: {
            [target]: {
                signature: process.env.HANASAND_APP_UPDATE_SIGNATURE || platformManifest?.signature || '',
                url: `${publicBaseURL()}/app/download/${encodeURIComponent(artifactName)}`,
            },
        },
    })
}

export async function downloadAppUpdate(req: FastifyRequest<{ Querystring: AppDownloadQuery }>, res: FastifyReply) {
    const platform = normalizePlatform(req.query.platform)
    return sendAppUpdatePackage(res, platform)
}

export async function downloadNamedAppUpdate(req: FastifyRequest<{ Params: TauriDownloadParams }>, res: FastifyReply) {
    return sendNamedAppUpdatePackage(res, req.params.name)
}

async function sendAppUpdatePackage(res: FastifyReply, platform: string) {
    const update = await configuredUpdate()
    const file = update.file

    if (!file) {
        return res.status(404).send({
            error: 'No app update package is configured.',
            hint: `Upload manifest.json and the package to ${updateDirectory()}, or set HANASAND_APP_UPDATE_FILE to a readable dmg, zip, or pkg.`,
        })
    }

    const filename = path.basename(file.absolute)
    res.header('Content-Type', 'application/octet-stream')
    res.header('Cache-Control', 'no-store')
    res.header('Content-Length', String(file.size))
    res.header('Content-Disposition', `attachment; filename="${filename}"`)
    res.header('X-Hanasand-App-Platform', platform)
    res.header('X-Hanasand-App-Version', update.version)
    res.header('X-Hanasand-App-Sha256', file.sha256)

    return res.send(createReadStream(file.absolute))
}

async function sendNamedAppUpdatePackage(res: FastifyReply, name: string) {
    const safeName = path.basename(name || '')
    if (!safeName || safeName !== name) {
        return res.status(400).send({ error: 'Invalid app update package name.' })
    }

    const file = await fileMetadata(path.resolve(updateDirectory(), safeName)).catch(() => null)
    if (!file) {
        return res.status(404).send({ error: 'App update package was not found.' })
    }

    const update = await configuredUpdate()
    res.header('Content-Type', 'application/octet-stream')
    res.header('Cache-Control', 'no-store')
    res.header('Content-Length', String(file.size))
    res.header('Content-Disposition', `attachment; filename="${safeName}"`)
    res.header('X-Hanasand-App-Platform', 'macos')
    res.header('X-Hanasand-App-Version', update.version)
    res.header('X-Hanasand-App-Sha256', file.sha256)

    return res.send(createReadStream(file.absolute))
}
