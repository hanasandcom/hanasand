import type { FetchResult } from './routeHelpers'
import { rows, latestTimestamp } from './routeHelpers'
import { deployLedgerFromStatusPayload } from '@/utils/productProgress/deployLedger'

export function deployProbeReadiness(input: {
    generatedAt: string
    route: string
    fetch: FetchResult
    sourceProxyOk: boolean
}) {
    const payload = input.fetch.json as {
        overall?: string
        generated_at?: string
        checks?: Array<{
            service?: string
            check_name?: string
            status?: string
            checked_at?: string
        }>
    } | undefined
    const ledger = deployLedgerFromStatusPayload(payload)
    const checks = rows(payload?.checks)
    const frontendHealthy = ledger?.frontendHealthy ?? serviceHealthy(checks, ['website', 'frontend', 'content delivery'])
    const apiHealthy = ledger?.apiHealthy ?? serviceHealthy(checks, ['api', 'core platform', 'service'])
    const scraperHealthy = ledger?.scraperHealthy ?? (input.sourceProxyOk || serviceHealthy(checks, ['automation', 'ti scraper', 'scraper']))
    const latestProbeAt = ledger?.latestProbeAt || latestTimestamp([
        ledger?.generatedAt || '',
        payload?.generated_at || '',
        ...checks.map(row => String(row.checked_at || '')),
    ])
    const blockers = [
        input.fetch.ok ? '' : input.fetch.error || `Status route returned HTTP ${input.fetch.status}.`,
        ledger || checks.length > 0 ? '' : 'Status route returned no service checks.',
        frontendHealthy ? '' : 'Website health is not up in /api/status.',
        apiHealthy ? '' : 'API health is not up in /api/status.',
        scraperHealthy ? '' : 'Scraper health is not up in /api/status or source proxy.',
        latestProbeAt ? '' : ledger ? 'Deploy check ledger did not include a probe timestamp.' : 'Status route did not include a probe timestamp.',
        ...(ledger?.blockers || []),
    ].filter(Boolean)

    return {
        schemaVersion: 'product.deploy_probe.readiness.v1',
        status: blockers.length ? 'needs_action' as const : 'ready' as const,
        checkedAt: input.generatedAt,
        source: ledger?.source || (ledger ? `${input.route}#productProgressDeployProof` : input.route),
        href: '/status',
        deployedCommit: ledger?.deployedCommit || process.env.NEXT_PUBLIC_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_SHA || process.env.GIT_SHA || undefined,
        frontendHealthy,
        apiHealthy,
        scraperHealthy,
        latestProbeAt,
        dashboardAlertId: ledger?.dashboardAlertId,
        deliveryId: ledger?.deliveryId,
        ledgerPath: ledger?.ledgerPath,
        blockers,
        ownerLane: 'integration' as const,
        unavailableReason: blockers.length ? 'missing_live_deploy_probe' : undefined,
        staleAfterSeconds: 600,
        proofTimestamp: latestProbeAt || input.generatedAt,
        expectedDashboardRowId: 'deploy_probe',
        integrationProbeHint: 'GET /api/status must return fresh website/API checks and, after deploy, productProgressDeployProof with deployed commit, service health, dashboard alert id, delivery id, and probe time.',
        backendProofContractVersion: ledger?.schemaVersion || 'status.public_service.v1',
        detail: blockers.length
            ? blockers.join('; ')
            : ledger
                ? 'Deploy check ledger is current for website, API, scraper, dashboard alert, and delivery checks.'
                : 'Website, API, and scraper health are current.',
    }
}

function serviceHealthy(checks: Array<Record<string, unknown>>, labels: string[]) {
    return checks.some(check => {
        const service = String(check.service || '').toLowerCase()
        const name = String(check.check_name || '').toLowerCase()
        const status = String(check.status || '').toLowerCase()
        return status === 'up' && labels.some(label => service === label || name === label || service.includes(label) || name.includes(label))
    })
}

