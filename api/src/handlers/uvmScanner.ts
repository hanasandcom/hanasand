import type { FastifyReply, FastifyRequest } from 'fastify'
import { randomUUID } from 'node:crypto'
import { requestUvmService, ScannerRequestError } from '#utils/vulnerabilities/scanner.ts'
import { HANASAND_ORGANIZATION_ID } from '#utils/auth/organizationPagePolicy.ts'
import { withDatabaseAdvisoryLock } from '#db'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { checkBillingCapacity } from './billing.ts'
import { requireHanasandInternalAccess } from './uvmScannerAccess.ts'

export async function getUvm(req: FastifyRequest, res: FastifyReply) {
    if (!await requireHanasandInternalAccess(req, res)) return
    try { return res.send(await requestUvmService(`/v1/uvm/dashboard?organizationId=${organizationId()}`)) }
    catch (error) {
        logScannerFailure('UVM Scanner dashboard request failed', error)
        return res.send({ assets: [], engines: [], runs: [], assessments: [], findings: [], tenableIntegration: null, tenableScans: [], scannerError: 'Scanner service is temporarily unavailable.' })
    }
}

export async function postUvmAsset(req: FastifyRequest, res: FastifyReply) {
    const actorId = await requireHanasandInternalAccess(req, res)
    if (!actorId) return
    const body = req.body as { hostname?: unknown } | undefined
    try {
        return await withDatabaseAdvisoryLock(`uvm:asset-quota:${HANASAND_ORGANIZATION_ID}`, async() => {
            const { assets } = await requestUvmService<{ assets: Array<{ hostname: string }> }>(`/v1/uvm/assets?organizationId=${organizationId()}`)
            const normalizedHostname = typeof body?.hostname === 'string' ? body.hostname.trim().replace(/\.$/, '').toLowerCase() : ''
            const alreadyRegistered = assets.some(asset => asset.hostname === normalizedHostname)
            if (!alreadyRegistered) {
                const quota = await checkBillingCapacity(actorId, 'monitoredTargets', assets.length)
                if (!quota.allowed) return res.status(quota.subscriptionRequired ? 402 : 409).send({ error: quota.subscriptionRequired ? 'subscription_required' : 'quota_exhausted', message: 'Your monitored-target quota has been reached.', quota })
            }
            const { asset } = await requestUvmService<{ asset: any }>('/v1/uvm/assets', { method: 'POST', body: { organizationId: HANASAND_ORGANIZATION_ID, hostname: body?.hostname, actorId } })
            await recordSystemEvent(req, { actionType: 'security_scanner.asset.created', actorId, targetType: 'security_scanner_asset', targetId: asset.id, context: { hostname: asset.hostname } })
            return res.status(201).send({ asset })
        })
    } catch (error) {
        return scannerErrorReply(res, error)
    }
}

export async function postUvmAssetVerification(req: FastifyRequest, res: FastifyReply) {
    const actorId = await requireHanasandInternalAccess(req, res)
    if (!actorId) return
    const { assetId } = req.params as { assetId: string }
    try {
        const { asset } = await requestUvmService<{ asset: any }>(`/v1/uvm/assets/${encodeURIComponent(assetId)}/verify?organizationId=${organizationId()}`, { method: 'POST', body: { actorId } })
        if (!asset) return res.status(404).send({ error: 'Asset not found.' })
        await recordSystemEvent(req, { actionType: 'security_scanner.asset.verification_checked', actorId, targetType: 'security_scanner_asset', targetId: asset.id, context: { hostname: asset.hostname, status: asset.verificationStatus } })
        return res.send({ asset })
    } catch (error) {
        return scannerErrorReply(res, error, 'Domain verification lookup failed.')
    }
}

export async function putUvmAssetSchedule(req: FastifyRequest, res: FastifyReply) {
    const actorId = await requireHanasandInternalAccess(req, res)
    if (!actorId) return
    const { assetId } = req.params as { assetId: string }
    const body = req.body as { enabled?: unknown, intervalMinutes?: unknown, authorized?: unknown, engine?: unknown, scanId?: unknown } | undefined
    if (typeof body?.enabled !== 'boolean') return res.status(400).send({ error: 'Choose whether the schedule is enabled.' })
    if (!['nmap', 'tenable-vm'].includes(String(body.engine ?? 'nmap'))) return res.status(400).send({ error: 'Choose a supported scan engine.' })
    const intervalMinutes = Number(body.intervalMinutes)
    if (!Number.isInteger(intervalMinutes) || intervalMinutes < 5 || intervalMinutes > 1440) return res.status(400).send({ error: 'Scan interval must be between 5 and 1,440 minutes.' })
    try {
        if (body.enabled && !await requireUvmCapacity(actorId, res)) return
        const { asset } = await requestUvmService<{ asset: any }>(`/v1/uvm/assets/${encodeURIComponent(assetId)}/schedule?organizationId=${organizationId()}`, { method: 'PUT', body: {
            enabled: body.enabled, intervalMinutes, authorized: body.authorized === true,
            engine: body.engine ?? 'nmap', scanId: typeof body.scanId === 'string' ? body.scanId : undefined, actorId,
        } })
        if (!asset) return res.status(404).send({ error: 'Asset not found.' })
        await recordSystemEvent(req, { actionType: 'security_scanner.asset.schedule_updated', actorId, targetType: 'security_scanner_asset', targetId: asset.id, context: { enabled: asset.scheduleEnabled, engine: asset.scheduleEngine, scanId: asset.scheduleScanId, intervalMinutes: asset.intervalMinutes, authorizedAddresses: asset.authorizedAddresses } })
        return res.send({ asset })
    } catch (error) {
        return scannerErrorReply(res, error)
    }
}

export async function postUvmAssetScan(req: FastifyRequest, res: FastifyReply) {
    const actorId = await requireHanasandInternalAccess(req, res)
    if (!actorId) return
    const { assetId } = req.params as { assetId: string }
    const body = req.body as { authorized?: unknown } | undefined
    try {
        if (!await requireUvmCapacity(actorId, res)) return
        const { run: scan } = await requestUvmService<{ run: any }>(`/v1/uvm/assets/${encodeURIComponent(assetId)}/scans?organizationId=${organizationId()}`, { method: 'POST', body: { actorId, requestId: randomUUID(), authorized: body?.authorized === true } })
        await recordSystemEvent(req, { actionType: 'security_scanner.execution.started', actorId, targetType: 'security_scanner_asset', targetId: assetId, context: { engine: 'nmap', profile: 'tcp-top-100', runId: scan.runId, addresses: scan.addresses } })
        return res.status(202).send({ run: scan })
    } catch (error) {
        return scannerErrorReply(res, error)
    }
}

export async function putUvmTenableIntegration(req: FastifyRequest, res: FastifyReply) {
    const actorId = await requireHanasandInternalAccess(req, res)
    if (!actorId) return
    const body = req.body as { region?: unknown, accessKey?: unknown, secretKey?: unknown } | undefined
    if (!['us', 'eu', 'de', 'au', 'ca', 'jp'].includes(String(body?.region))) return res.status(400).send({ error: 'Choose a supported Tenable cloud region.' })
    if (typeof body?.accessKey !== 'string' || typeof body?.secretKey !== 'string' || !body.accessKey.trim() || !body.secretKey.trim()) return res.status(400).send({ error: 'Enter both Tenable API keys.' })
    try {
        const { integration } = await requestUvmService<{ integration: any }>(`/v1/uvm/integrations/tenable?organizationId=${organizationId()}`, { method: 'PUT', body: { region: body.region, accessKey: body.accessKey.trim(), secretKey: body.secretKey.trim(), actorId } })
        await recordSystemEvent(req, { actionType: 'security_scanner.integration.connected', actorId, targetType: 'security_scanner_integration', targetId: 'tenable-vm', context: { region: integration.region, configured: integration.configured } })
        return res.send({ integration })
    } catch (error) {
        return scannerErrorReply(res, error)
    }
}

export async function deleteUvmTenableIntegration(req: FastifyRequest, res: FastifyReply) {
    const actorId = await requireHanasandInternalAccess(req, res)
    if (!actorId) return
    try {
        const { integration } = await requestUvmService<{ integration: any }>(`/v1/uvm/integrations/tenable?organizationId=${organizationId()}`, { method: 'DELETE', body: { actorId } })
        await recordSystemEvent(req, { actionType: 'security_scanner.integration.disconnected', actorId, targetType: 'security_scanner_integration', targetId: 'tenable-vm', context: {} })
        return res.send({ integration })
    } catch (error) {
        return scannerErrorReply(res, error)
    }
}

export async function postUvmAssetTenableScan(req: FastifyRequest, res: FastifyReply) {
    const actorId = await requireHanasandInternalAccess(req, res)
    if (!actorId) return
    const { assetId } = req.params as { assetId: string }
    const body = req.body as { authorized?: unknown, scanId?: unknown } | undefined
    if (typeof body?.scanId !== 'string' || !body.scanId.trim()) return res.status(400).send({ error: 'Choose a Tenable scan template.' })
    try {
        if (!await requireUvmCapacity(actorId, res)) return
        const { run: scan } = await requestUvmService<{ run: any }>(`/v1/uvm/assets/${encodeURIComponent(assetId)}/tenable-scans?organizationId=${organizationId()}`, { method: 'POST', body: { actorId, requestId: randomUUID(), scanId: body.scanId, authorized: body.authorized === true } })
        await recordSystemEvent(req, { actionType: 'security_scanner.execution.started', actorId, targetType: 'security_scanner_asset', targetId: assetId, context: { engine: 'tenable-vm', profile: body.scanId, runId: scan.runId, addresses: scan.addresses } })
        return res.status(202).send({ run: scan })
    } catch (error) {
        return scannerErrorReply(res, error)
    }
}

export async function postUvmAssessment(req: FastifyRequest, res: FastifyReply) {
    const actorId = await requireHanasandInternalAccess(req, res)
    if (!actorId) return
    const input = validateAssessmentBody(req.body)
    if (!input) return res.status(400).send({ error: 'Choose one to ten registered assets and supported scanners. Confirm authorization for the assessment.' })
    try {
        if (!await requireUvmCapacity(actorId, res)) return
        const { assessment } = await requestUvmService<{ assessment: any }>('/v1/uvm/assessments', { method: 'POST', body: { ...input, organizationId: HANASAND_ORGANIZATION_ID, actorId } })
        if (!assessment) return res.status(500).send({ error: 'The assessment could not be loaded after launch.' })
        await recordSystemEvent(req, {
            actionType: 'security_scanner.assessment.started', actorId, targetType: 'security_scanner_assessment', targetId: assessment.id,
            context: { assetCount: input.assetIds.length, engines: input.engines.map(item => item.engine), jobCount: assessment.jobs.length },
        })
        return res.status(202).send({ assessment })
    } catch (error) {
        return scannerErrorReply(res, error)
    }
}

export async function postUvmAssessmentCancel(req: FastifyRequest, res: FastifyReply) {
    const actorId = await requireHanasandInternalAccess(req, res)
    if (!actorId) return
    const { assessmentId } = req.params as { assessmentId: string }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(assessmentId)) {
        return res.status(400).send({ error: 'Invalid assessment ID.' })
    }
    try {
        const { assessment } = await requestUvmService<{ assessment: any }>(`/v1/uvm/assessments/${encodeURIComponent(assessmentId)}/cancel?organizationId=${organizationId()}`, { method: 'POST', body: { actorId } })
        if (!assessment) return res.status(404).send({ error: 'Assessment not found.' })
        await recordSystemEvent(req, { actionType: 'security_scanner.assessment.cancelled', actorId, targetType: 'security_scanner_assessment', targetId: assessment.id, context: {} })
        return res.send({ assessment })
    } catch (error) {
        return scannerErrorReply(res, error)
    }
}

export async function putUvmFinding(req: FastifyRequest, res: FastifyReply) {
    const actorId = await requireHanasandInternalAccess(req, res)
    if (!actorId) return
    const { findingId } = req.params as { findingId: string }
    const body = req.body as { status?: unknown, note?: unknown } | undefined
    const allowed = ['open', 'in_progress', 'pending_verification', 'accepted_risk', 'false_positive']
    if (typeof body?.status !== 'string' || !allowed.includes(body.status)) return res.status(400).send({ error: 'Choose a valid triage status. Findings are resolved after a later successful scan confirms the fix.' })
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : ''
    if (['accepted_risk', 'false_positive'].includes(body.status) && note.length < 8) return res.status(400).send({ error: 'Add a short reason before accepting risk or marking a false positive.' })
    let finding: any
    try {
        ({ finding } = await requestUvmService<{ finding: any }>(`/v1/uvm/findings/${encodeURIComponent(findingId)}?organizationId=${organizationId()}`, { method: 'PUT', body: { status: body.status, note, actorId } }))
    } catch (error) { return scannerErrorReply(res, error) }
    if (!finding) return res.status(404).send({ error: 'Finding not found.' })
    await recordSystemEvent(req, { actionType: 'security_scanner.finding.triaged', actorId, targetType: 'security_scanner_finding', targetId: findingId, context: { status: finding.status, noteProvided: Boolean(note) } })
    return res.send({ finding })
}

export async function getUvmRun(req: FastifyRequest, res: FastifyReply) {
    if (!await requireHanasandInternalAccess(req, res)) return
    const { runId } = req.params as { runId: string }
    let scan: any
    try { ({ run: scan } = await requestUvmService<{ run: any }>(`/v1/uvm/runs/${encodeURIComponent(runId)}?organizationId=${organizationId()}`)) }
    catch (error) { return scannerErrorReply(res, error) }
    if (!scan) return res.status(404).send({ error: 'Scan run not found.' })
    return res.send({ run: scan })
}

export async function postUvmRunCancel(req: FastifyRequest, res: FastifyReply) {
    const actorId = await requireHanasandInternalAccess(req, res)
    if (!actorId) return
    const { runId } = req.params as { runId: string }
    try {
        const { run: scan } = await requestUvmService<{ run: any }>(`/v1/uvm/runs/${encodeURIComponent(runId)}/cancel?organizationId=${organizationId()}`, { method: 'POST', body: { actorId } })
        if (!scan) return res.status(404).send({ error: 'Scan run not found.' })
        await recordSystemEvent(req, { actionType: 'security_scanner.execution.cancelled', actorId, targetType: 'security_scanner_run', targetId: runId, context: {} })
        return res.send({ run: scan })
    } catch (error) {
        return scannerErrorReply(res, error)
    }
}

function organizationId() { return encodeURIComponent(HANASAND_ORGANIZATION_ID) }
async function requireUvmCapacity(actorId: string, res: FastifyReply) {
    const { assets } = await requestUvmService<{ assets: unknown[] }>(`/v1/uvm/assets?organizationId=${organizationId()}`)
    const quota = await checkBillingCapacity(actorId, 'monitoredTargets', assets.length)
    if (quota.allowed) return true
    res.status(quota.subscriptionRequired ? 402 : 409).send({ error: quota.subscriptionRequired ? 'subscription_required' : 'quota_exhausted', message: quota.subscriptionRequired ? 'A scanner subscription is required for UVM assessments.' : 'Your monitored-target quota has been reached.', quota })
    return false
}
function scannerErrorReply(res: FastifyReply, error: unknown, fallback = 'The Scanner service is temporarily unavailable.') {
    logScannerFailure('UVM Scanner service request failed', error)
    if (error instanceof ScannerRequestError && error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 403) {
        return res.status(error.status).send({ error: error.message })
    }
    return res.status(502).send({ error: fallback })
}

function logScannerFailure(message: string, error: unknown) {
    console.error(message, { status: error instanceof ScannerRequestError ? error.status : null, name: error instanceof Error ? error.name : 'UnknownError' })
}

function validateAssessmentBody(value: unknown): { requestId: string, assetIds: string[], engines: Array<{ engine: string, scanId?: string }>, authorized: boolean } | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const body = value as Record<string, unknown>
    if (typeof body.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)) return null
    if (!Array.isArray(body.assetIds) || !body.assetIds.length || body.assetIds.length > 10 || body.assetIds.some(id => typeof id !== 'string' || !id.trim())) return null
    if (new Set(body.assetIds).size !== body.assetIds.length) return null
    if (!Array.isArray(body.engines) || !body.engines.length || body.engines.length > 3 || body.engines.some(engine => {
        if (!engine || typeof engine !== 'object' || Array.isArray(engine)) return true
        const selection = engine as Record<string, unknown>
        if (!['nmap', 'gvm', 'tenable-vm'].includes(String(selection.engine))) return true
        return selection.engine === 'tenable-vm' ? typeof selection.scanId !== 'string' || !/^\d{1,12}$/.test(selection.scanId) : Object.hasOwn(selection, 'scanId')
    })) return null
    if (new Set(body.engines.map(engine => (engine as Record<string, unknown>).engine)).size !== body.engines.length || typeof body.authorized !== 'boolean') return null
    return { requestId: body.requestId, assetIds: body.assetIds as string[], engines: body.engines as Array<{ engine: string, scanId?: string }>, authorized: body.authorized }
}
