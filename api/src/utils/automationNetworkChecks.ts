import { connect as connectTcp } from 'node:net'
import type { AutomationRow } from './automationTypes.ts'
import { monitoringLookup, publicMonitoringRequest, resolveMonitoringAddresses } from './publicMonitoringRequest.ts'

export async function runHttpCheck(target: URL, automation: AutomationRow, timeoutMs: number) {
    const checksGitRefs = target.pathname.endsWith('/info/refs') && target.searchParams.get('service') === 'git-upload-pack'
    const response = await publicMonitoringRequest(target, {
        method: automation.monitoring_type === 'post' ? 'POST' : 'GET', followRedirects: automation.follow_redirects,
        userAgent: automation.user_agent, timeoutMs, readBody: checksGitRefs,
    })
    const body = response.body
    const hasMainRef = !checksGitRefs || body.includes('refs/heads/main')
    return { up: response.status >= 200 && response.status < 300 && hasMainRef, detail: checksGitRefs ? `returned HTTP ${response.status}${hasMainRef ? ' with refs/heads/main' : ' without refs/heads/main'}` : `returned HTTP ${response.status}` }
}

export async function runSocketCheck(automation: AutomationRow, timeoutMs: number) {
    const raw = automation.target_url || ''
    const [host, portText] = raw.split(':')
    const port = Number(portText) || (automation.monitoring_type === 'ssh' ? 22 : 80)
    const signal = AbortSignal.timeout(timeoutMs)
    const addresses = await resolveMonitoringAddresses(host, signal)
    return new Promise<{ up: boolean, detail: string }>((resolve, reject) => {
        const socket = connectTcp({ host, port, lookup: monitoringLookup(addresses), signal })
        let settled = false
        const finish = (value: { up: boolean, detail: string }) => { if (!settled) { settled = true; socket.destroy(); resolve(value) } }
        socket.setTimeout(timeoutMs, () => socket.destroy(new Error(`Connection timed out after ${automation.timeout_seconds} seconds.`)))
        socket.once('connect', () => {
            if (automation.monitoring_type === 'ssh') socket.once('data', data => {
                const hasSshBanner = /^SSH-/.test(data.toString())
                finish({ up: hasSshBanner, detail: hasSshBanner ? 'returned an SSH banner' : 'did not return an SSH banner' })
            })
            else finish({ up: true, detail: `accepted a TCP connection on port ${port}` })
        })
        socket.once('error', error => reject(new Error(`Connection failed: ${error.message}`)))
    })
}
