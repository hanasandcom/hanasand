import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { BrowserWarmPool, type WarmWorker, type WarmStatus } from '#utils/ws/browserWarmPool.ts'
import { createRuntimeContainer, getRuntimeContainer, removeRuntimeContainer, renameRuntimeContainer, startRuntimeContainer } from '#utils/docker/engine.ts'
import { browserTurnCredentials } from './browserStreamRuntime.ts'

const browserWorkerSeccompProfile = fs.readFileSync(new URL('../../../seccomp-chromium.json', import.meta.url), 'utf8')

export const browserWarmPool = new BrowserWarmPool({
    async inspect(slot) {
        const inspect = await getRuntimeContainer(`hanasand_browser_warm_${slot}`).catch(error => {
            if (String(error).includes('No such container')) return null
            throw error
        })
        if (!inspect?.Id) return null
        const ip = inspect.NetworkSettings?.Networks?.[process.env.BROWSER_SANDBOX_WORKER_NETWORK || 'hanasand_browsernet']?.IPAddress
        const token = inspect.Config?.Env?.find(value => value.startsWith('BROWSER_SANDBOX_POOL_TOKEN='))?.split('=')[1] || ''
        return { containerId: inspect.Id, wsUrl: `ws://${ip}:8090/api/ws`, streamIp: ip || '', token, createdAt: Date.parse(inspect.Created || ''), running: inspect.State?.Running }
    },
    async create(slot) {
        try { await startEphemeralBrowserWorker(`warm-${slot}`, '1280x720', slot) }
        catch (error) {
            // Another API replica may have filled the same empty slot first.
            if (!String(error).includes('already in use')) throw error
        }
    },
    async status(worker) {
        if (!worker.streamIp || !worker.token) return null
        const response = await warmWorkerRequest(worker).catch(() => null)
        if (!response?.ok) return null
        const status = await response.json() as WarmStatus
        if (status.state === 'ready' && !await fetch(`http://${worker.streamIp}:8080/health`, { signal: AbortSignal.timeout(1000) }).then(r => r.ok).catch(() => false)) return null
        return status
    },
    async claim(worker, sessionId) {
        const response = await warmWorkerRequest(worker, { sessionId })
        if (response.status === 409) return false
        if (!response.ok) throw new Error(`Browser claim failed: ${response.status}`)
        return true
    },
    async detach(worker) { await renameRuntimeContainer(worker.containerId, `hanasand_browser_warm_used_${worker.containerId.slice(0, 24)}`) },
    async retire(worker) { return (await warmWorkerRequest(worker, { retire: true })).ok },
    async remove(worker) { await removeRuntimeContainer(worker.containerId).catch(error => { if (!String(error).includes('No such container')) throw error }) },
    error(error) { console.error('Browser ready pool:', error instanceof Error ? error.message : String(error)) },
})

function warmWorkerRequest(worker: WarmWorker, body?: { sessionId?: string; retire?: boolean }) {
    return fetch(`http://${worker.streamIp}:8090/internal/browser-warm`, {
        method: body ? 'POST' : 'GET',
        headers: { 'x-browser-pool-token': worker.token, 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(1500),
    })
}

export function assertBrowserWorkerEgress() {
    if (process.env.NODE_ENV === 'production' && process.env.BROWSER_SANDBOX_EGRESS_FIREWALL_READY !== '1') {
        throw new Error('Browser sandbox egress firewall is not marked ready. Run browser-worker/install-egress-firewall.sh from the ops repository before enabling production browser sessions.')
    }
}

export async function startEphemeralBrowserWorker(sessionId: string, resolution = '1280x720', warmSlot?: number) {
    assertBrowserWorkerEgress()
    const containerName = warmSlot === undefined ? `hanasand_browser_session_${sessionId.replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 48)}_${randomUUID().slice(0, 8)}` : `hanasand_browser_warm_${warmSlot}`
    const networkName = process.env.BROWSER_SANDBOX_WORKER_NETWORK || 'hanasand_browsernet'
    const turn = browserTurnCredentials(sessionId, warmSlot === undefined ? 60 * 60 : 120 * 60)
    const containerId = await createRuntimeContainer(containerName, {
        Image: process.env.BROWSER_SANDBOX_WORKER_IMAGE || 'hanasand_browsers:latest',
        User: '1000',
        Env: [
            'NODE_ENV=production',
            'PORT=8090',
            'HOME=/tmp',
            'USER=ubuntu',
            'DISPLAY=:20',
            'START_XFCE4=false',
            `BROWSER_STREAM_RESOLUTION=${resolution}`,
            'BROWSER_SANDBOX_WORKER_ONLY=1',
            // Provider checks use regular-network headless Chromium, isolated from the streamed display.
            'BROWSER_SANDBOX_PROVIDER_DISPLAY=',
            'BROWSER_SANDBOX_SKIP_RUN_DB=1',
            'BROWSER_SANDBOX_CHROMIUM_SANDBOX=1',
            'BROWSER_SANDBOX_MAX_SESSIONS=1',
            'BROWSER_SANDBOX_PREWARM=0',
            ...(warmSlot === undefined ? [] : [`BROWSER_SANDBOX_POOL_TOKEN=${randomUUID()}`]),
            'SELKIES_ENABLE_BASIC_AUTH=false',
            'SELKIES_ENABLE_RESIZE=false',
            'SELKIES_ENCODER=x264enc',
            'SELKIES_FRAMERATE=60',
            'SELKIES_KEYFRAME_DISTANCE=1',
            'SELKIES_CONGESTION_CONTROL=true',
            'SELKIES_VIDEO_BITRATE=4000',
            `SELKIES_TURN_HOST=${turn.host}`,
            'SELKIES_TURN_PORT=3478',
            'SELKIES_TURN_PROTOCOL=udp',
            `SELKIES_TURN_USERNAME=${turn.username}`,
            `SELKIES_TURN_PASSWORD=${turn.password}`,
            `ONION_SESSION_PROXY=${process.env.ONION_SESSION_PROXY || 'socks5://hanasand_onion_tor:9050'}`,
        ],
        ExposedPorts: { '8080/tcp': {}, '8090/tcp': {}, '9081/tcp': {} },
        Healthcheck: {
            Test: ['CMD-SHELL', 'curl -fsS --max-time 3 http://127.0.0.1:8080/health'],
            Interval: 10_000_000_000,
            Timeout: 5_000_000_000,
            Retries: 3,
            StartPeriod: 20_000_000_000,
        },
        HostConfig: {
            NetworkMode: networkName,
            AutoRemove: true,
            Init: true,
            Privileged: false,
            IpcMode: 'private',
            ReadonlyRootfs: true,
            Tmpfs: {
                '/tmp': 'rw,noexec,nosuid,size=1g',
                '/etc/nginx/sites-available': 'rw,noexec,nosuid,size=1m,uid=1000,gid=1000',
                '/var/lib/nginx': 'rw,noexec,nosuid,size=16m,uid=1000,gid=1000',
            },
            CapAdd: [],
            CapDrop: ['ALL'],
            SecurityOpt: [`seccomp=${browserWorkerSeccompProfile}`, 'apparmor=docker-default', 'no-new-privileges'],
            ShmSize: 1024 * 1024 * 1024,
            Memory: 3 * 1024 * 1024 * 1024,
            NanoCpus: 3_000_000_000,
            PidsLimit: 512,
        },
        Labels: {
            'com.hanasand.role': 'browser-session-worker',
            'com.hanasand.session': sessionId,
        },
    }, warmSlot !== undefined)

    try {
        await startRuntimeContainer(containerId)
        const inspect = await getRuntimeContainer(containerId)
        const ip = inspect.NetworkSettings?.Networks?.[networkName]?.IPAddress
        return { containerId, wsUrl: `ws://${ip || containerName}:8090/api/ws`, streamIp: ip || containerName }
    } catch (error) {
        await removeRuntimeContainer(containerId).catch(() => undefined)
        throw error
    }
}
