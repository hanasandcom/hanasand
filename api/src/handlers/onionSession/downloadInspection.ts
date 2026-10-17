import { createHash } from 'node:crypto'
import type { Download, Page } from 'playwright'
import { fileReputation, inspectDownload, type FileReputation } from './downloads.ts'
import { withTimeout } from './asyncOperations.ts'
import { collectRenderedText } from './pageEvidence.ts'
import type { SessionState } from './sessionState.ts'
import type { SandboxNetworkEvent } from './networkTelemetry.ts'

interface DownloadInspectionDependencies {
    state: SessionState
    send: (payload: Record<string, unknown>) => void
    isCurrentRun: (generation: number) => boolean
    newBackgroundPage: (context: NonNullable<SessionState['context']>, generation: number) => Promise<Page>
    watchConsole: (page: Page, generation: number, category?: string, label?: string) => void
    focusRemoteTab: (visible?: boolean, generation?: number) => Promise<void>
    publishDownloads: () => void
}

export function createDownloadInspectionService(deps: DownloadInspectionDependencies) {
    const { state, send, isCurrentRun, newBackgroundPage, watchConsole, focusRemoteTab, publishDownloads } = deps

    function watchDownloads(page: Page, generation: number) {
        page.on('download', download => { void captureDownload(download, generation) })
        page.on('popup', popup => watchDownloads(popup, generation))
    }

    async function lookupFile(sha256: string, generation: number): Promise<FileReputation> {
        if (!isCurrentRun(generation) || !state.context) return { status: 'interrupted', detail: 'Run ended before the hash lookup finished' }
        const lookupPage = await newBackgroundPage(state.context, generation)
        if (!isCurrentRun(generation)) {
            await lookupPage.close().catch(() => undefined)
            return { status: 'interrupted', detail: 'Run ended before the hash lookup finished' }
        }
        watchConsole(lookupPage, generation, 'virustotal-file', 'VirusTotal file')
        try {
            await focusRemoteTab(false, generation)
            if (!isCurrentRun(generation)) return { status: 'interrupted', detail: 'Run ended before the hash lookup finished' }
            const bodies: string[] = []
            lookupPage.on('response', response => {
                const url = new URL(response.url())
                if (url.hostname === 'www.virustotal.com' && url.pathname === `/ui/files/${sha256}`) {
                    void response.text().then(body => bodies.push(body.slice(0, 80_000))).catch(() => undefined)
                }
            })
            await lookupPage.goto(`https://www.virustotal.com/gui/file/${sha256}`, { waitUntil: 'domcontentloaded', timeout: 15_000 })
            if (!isCurrentRun(generation)) return { status: 'interrupted', detail: 'Run ended before the hash lookup finished' }
            await focusRemoteTab(false, generation)
            const deadline = Date.now() + 20_000
            let result: FileReputation = fileReputation('', sha256)
            while (isCurrentRun(generation) && Date.now() < deadline) {
                const text = [bodies.join('\n'), await withTimeout(collectRenderedText(lookupPage), 1500, '')].join('\n')
                result = fileReputation(text, sha256)
                if (result.status === 'known' || result.status === 'unknown' || /access limited/.test(result.detail || '')) break
                await lookupPage.waitForTimeout(500)
            }
            return isCurrentRun(generation) ? result : { status: 'interrupted', detail: 'Run ended before the hash lookup finished' }
        } catch {
            const interrupted = !isCurrentRun(generation)
            return { status: interrupted ? 'interrupted' : 'unavailable', detail: interrupted ? 'Run ended before the hash lookup finished' : 'VirusTotal file lookup failed — no verdict' }
        } finally {
            await lookupPage.close().catch(() => undefined)
            if (isCurrentRun(generation)) await focusRemoteTab(false, generation)
        }
    }

    async function captureDownload(download: Download, generation: number) {
        if (!isCurrentRun(generation)) {
            await download.cancel().catch(() => undefined)
            await download.delete().catch(() => undefined)
            return
        }
        if (state.downloadCount >= 10 || state.downloadsInFlight >= 2) {
            await download.cancel().catch(() => undefined)
            await download.delete().catch(() => undefined)
            send({ type: 'status', state: 'download_limit', message: 'Download inspection limit reached (10 files per run, 2 transfers at a time).' })
            return
        }
        state.downloadCount++
        const file: SandboxNetworkEvent = { id: `file-${state.downloadCount}`, kind: 'download', url: download.url(), fileName: download.suggestedFilename(), hashStatus: 'downloading', at: new Date().toISOString() }
        state.networkTelemetry.record(file)
        state.downloadTargets.add(createHash('sha256').update(file.url).digest('hex'))
        state.downloadsInFlight++
        publishDownloads()
        try {
            Object.assign(file, await inspectDownload(download))
            if (!isCurrentRun(generation)) return
            state.networkTelemetry.refresh(file)
            if (file.sha256) {
                file.virusTotal = { status: 'checking', detail: 'Checking SHA-256 in VirusTotal…' }
                state.networkTelemetry.refresh(file)
                publishDownloads()
                const hash = file.sha256
                if (!state.fileLookups.has(hash)) {
                    const lookup = state.fileLookupQueue.then(() => lookupFile(hash, generation)).catch((): FileReputation => ({ status: isCurrentRun(generation) ? 'unavailable' : 'interrupted', detail: isCurrentRun(generation) ? 'VirusTotal lookup unavailable — no verdict' : 'Run ended before the hash lookup finished' }))
                    state.fileLookups.set(hash, lookup)
                    state.fileLookupQueue = lookup.then(() => undefined, () => undefined)
                }
                file.virusTotal = await state.fileLookups.get(hash)!
                if (!isCurrentRun(generation)) return
                state.networkTelemetry.refresh(file)
            }
        } catch {
            if (isCurrentRun(generation)) {
                file.hashStatus = 'Download failed or exceeded the 30-second limit'
                state.networkTelemetry.refresh(file)
            }
        } finally {
            if (isCurrentRun(generation)) {
                state.downloadsInFlight--
                publishDownloads()
            }
        }
    }

    return { watchDownloads, captureDownload }
}
