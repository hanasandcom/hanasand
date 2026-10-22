import config from '#constants'
import { lxdProjectPath, lxdRequest, waitForLxdOperation } from './lxd.ts'

const cacheTtlMs = 5 * 60_000
const usageCache = new Map<string, { at: number, bytes: number | null }>()
type ExecOperation = { status?: string, metadata?: { output?: Record<string, string>, return?: number } }

export function parseGuestRootDiskUsage(output: string): number | null {
    const row = output.split(/\r?\n/).slice(1).map(line => line.trim()).find(line => /\s\/$/.test(line))
    if (!row) return null
    const columns = row.split(/\s+/)
    if (columns.length < 6) return null
    const total = Number(columns[1]), used = Number(columns[2])
    return Number.isSafeInteger(total) && Number.isSafeInteger(used) && total > 0 && used >= 0 && used <= total ? used : null
}

export async function guestRootDiskUsage(name: string) {
    const cached = usageCache.get(name)
    if (cached && Date.now() - cached.at < cacheTtlMs) return cached.bytes
    let bytes: number | null = null
    try { bytes = await readGuestRootDiskUsage(name) } catch { /* Metrics stay available when a guest agent is offline. */ }
    usageCache.set(name, { at: Date.now(), bytes })
    return bytes
}

async function readGuestRootDiskUsage(name: string) {
    const base = `/1.0/instances/${encodeURIComponent(name)}`
    const outputDir = `${base}/logs/exec-output`
    const before = new Set(await lxdRequest<string[]>(outputDir).then(response => response.metadata))
    const started = await lxdRequest<unknown>(`${base}/exec`, {
        method: 'POST', timeout: 10_000,
        body: { command: ['df', '-B1', '-P', '/'], environment: { LC_ALL: 'C' }, 'record-output': true },
    })
    let outputPaths: Record<string, string> = {}
    try {
        const result = await waitForLxdOperation<ExecOperation>(started.operation, 20)
        outputPaths = result?.metadata.metadata?.output || {}
        if (result?.metadata.status !== 'Success' || result.metadata.metadata?.return !== 0) return null
        const stdout = await readOutput(outputPaths['1'])
        return parseGuestRootDiskUsage(stdout)
    } finally {
        const current = await lxdRequest<string[]>(outputDir).then(response => response.metadata).catch(() => [])
        const added = new Set([...Object.values(outputPaths), ...current.filter(path => !before.has(path))])
        await Promise.all([...added].map(path => lxdRequest(path, { method: 'DELETE' }).catch(() => {})))
    }
}

async function readOutput(path?: string) {
    if (!path || !path.startsWith('/1.0/instances/')) throw new Error('VM disk metric output is unavailable.')
    const response = await fetch(`http://localhost${lxdProjectPath(path, config.lxd_project)}`, {
        unix: config.lxd_socket_path,
        signal: AbortSignal.timeout(5_000),
    } as RequestInit & { unix: string })
    if (!response.ok) throw new Error(`LXD returned ${response.status} while reading VM disk metrics.`)
    return response.text()
}
