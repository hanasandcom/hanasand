import type { FastifyReply, FastifyRequest } from 'fastify'
import {
    cancelUvmRun, configureUvmTenable, createUvmAsset, disconnectUvmTenable, getUvmDashboard, getUvmNetworkRun,
    startUvmNetworkScan, startUvmTenableScan, updateUvmFinding, updateUvmSchedule, verifyUvmAsset,
    type UvmTriageStatus,
} from '#utils/vulnerabilities/uvmScanner.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { checkBillingCapacity } from './billing.ts'
import { requireHanasandInternalAccess } from './uvmScannerAccess.ts'

export async function getUvm(req: FastifyRequest, res: FastifyReply) {
    if (!await requireHanasandInternalAccess(req, res)) return
    return res.send(await getUvmDashboard())
}

export async function postUvmAsset(req: FastifyRequest, res: FastifyReply) {
    const actorId = await requireHanasandInternalAccess(req, res)
    if (!actorId) return
    const quota = await checkBillingCapacity(actorId, 'monitoredTargets', 1)
    if (!quota.allowed) return res.status(quota.subscriptionRequired ? 402 : 409).send({ error: quota.subscriptionRequired ? 'subscription_required' : 'quota_exhausted', message: 'Your monitored-target quota has been reached.', quota })
    const body = req.body as { hostname?: unknown } | undefined
    try {
        const asset = await createUvmAsset(body?.hostname, actorId)
        await recordSystemEvent(req, { actionType: 'security_scanner.asset.created', actorId, targetType: 'security_scanner_asset', targetId: asset.id, context: { hostname: asset.hostname } })
        return res.status(201).send({ asset })
    } catch (error) {
        return res.status(400).send({ error: errorMessage(error) })
    }
}

export async function postUvmAssetVerification(req: FastifyRequest, res: FastifyReply) {
    const actorId = await requireHanasandInternalAccess(req, res)
    if (!actorId) return
    const { assetId } = req.params as { assetId: string }
    try {
        const asset = await verifyUvmAsset(assetId)
        if (!asset) return res.status(404).send({ error: 'Asset not found.' })
        await recordSystemEvent(req, { actionType: 'security_scanner.asset.verification_checked', actorId, targetType: 'security_scanner_asset', targetId: asset.id, context: { hostname: asset.hostname, status: asset.verificationStatus } })
        return res.send({ asset })
    } catch (error) {
        return res.status(502).send({ error: `Domain verification lookup failed: ${errorMessage(error)}` })
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
    if (body.enabled) {
        const quota = await checkBillingCapacity(actorId, 'monitoredTargets', 1)
        if (!quota.allowed) return res.status(quota.subscriptionRequired ? 402 : 409).send({ error: quota.subscriptionRequired ? 'subscription_required' : 'quota_exhausted', message: 'Your monitored-target quota has been reached.', quota })
    }
    try {
        const asset = await updateUvmSchedule({
            assetId, enabled: body.enabled, intervalMinutes, authorized: body.authorized === true,
            engine: (body.engine ?? 'nmap') as 'nmap' | 'tenable-vm',
            scanId: typeof body.scanId === 'string' ? body.scanId : undefined, actorId,
        })
        if (!asset) return res.status(404).send({ error: 'Asset not found.' })
        await recordSystemEvent(req, { actionType: 'security_scanner.asset.schedule_updated', actorId, targetType: 'security_scanner_asset', targetId: asset.id, context: { enabled: asset.scheduleEnabled, engine: asset.scheduleEngine, scanId: asset.scheduleScanId, intervalMinutes: asset.intervalMinutes, authorizedAddresses: asset.authorizedAddresses } })
        return res.send({ asset })
    } catch (error) {
        return res.status(400).send({ error: errorMessage(error) })
    }
}

export async function postUvmAssetScan(req: FastifyRequest, res: FastifyReply) {
    const actorId = await requireHanasandInternalAccess(req, res)
    if (!actorId) return
    const { assetId } = req.params as { assetId: string }
    const body = req.body as { authorized?: unknown } | undefined
    const quota = await checkBillingCapacity(actorId, 'monitoredTargets', 1)
    if (!quota.allowed) return res.status(quota.subscriptionRequired ? 402 : 409).send({ error: quota.subscriptionRequired ? 'subscription_required' : 'quota_exhausted', message: 'Your monitored-target quota has been reached.', quota })
    try {
        const scan = await startUvmNetworkScan({ assetId, actorId, source: 'manual', authorized: body?.authorized === true })
        await recordSystemEvent(req, { actionType: 'security_scanner.execution.started', actorId, targetType: 'security_scanner_asset', targetId: assetId, context: { engine: 'nmap', profile: 'tcp-top-100', runId: scan.runId, addresses: scan.addresses } })
        return res.status(202).send({ run: scan })
    } catch (error) {
        return res.status(400).send({ error: errorMessage(error) })
    }
}

export async function putUvmTenableIntegration(req: FastifyRequest, res: FastifyReply) {
    const actorId = await requireHanasandInternalAccess(req, res)
    if (!actorId) return
    const body = req.body as { region?: unknown, accessKey?: unknown, secretKey?: unknown } | undefined
    if (!['us', 'eu', 'de', 'au', 'ca', 'jp'].includes(String(body?.region))) return res.status(400).send({ error: 'Choose a supported Tenable cloud region.' })
    if (typeof body?.accessKey !== 'string' || typeof body?.secretKey !== 'string' || !body.accessKey.trim() || !body.secretKey.trim()) return res.status(400).send({ error: 'Enter both Tenable API keys.' })
    try {
        const integration = await configureUvmTenable({ region: body.region as 'us' | 'eu' | 'de' | 'au' | 'ca' | 'jp', accessKey: body.accessKey.trim(), secretKey: body.secretKey.trim() })
        await recordSystemEvent(req, { actionType: 'security_scanner.integration.connected', actorId, targetType: 'security_scanner_integration', targetId: 'tenable-vm', context: { region: integration.region, configured: integration.configured } })
        return res.send({ integration })
    } catch (error) {
        return res.status(400).send({ error: errorMessage(error) })
    }
}

export async function deleteUvmTenableIntegration(req: FastifyRequest, res: FastifyReply) {
    const actorId = await requireHanasandInternalAccess(req, res)
    if (!actorId) return
    try {
        const integration = await disconnectUvmTenable()
        await recordSystemEvent(req, { actionType: 'security_scanner.integration.disconnected', actorId, targetType: 'security_scanner_integration', targetId: 'tenable-vm', context: {} })
        return res.send({ integration })
    } catch (error) {
        return res.status(502).send({ error: errorMessage(error) })
    }
}

export async function postUvmAssetTenableScan(req: FastifyRequest, res: FastifyReply) {
    const actorId = await requireHanasandInternalAccess(req, res)
    if (!actorId) return
    const { assetId } = req.params as { assetId: string }
    const body = req.body as { authorized?: unknown, scanId?: unknown } | undefined
    if (typeof body?.scanId !== 'string' || !body.scanId.trim()) return res.status(400).send({ error: 'Choose a Tenable scan template.' })
    const quota = await checkBillingCapacity(actorId, 'monitoredTargets', 1)
    if (!quota.allowed) return res.status(quota.subscriptionRequired ? 402 : 409).send({ error: quota.subscriptionRequired ? 'subscription_required' : 'quota_exhausted', message: 'Your monitored-target quota has been reached.', quota })
    try {
        const scan = await startUvmTenableScan({ assetId, actorId, scanId: body.scanId, authorized: body.authorized === true })
        await recordSystemEvent(req, { actionType: 'security_scanner.execution.started', actorId, targetType: 'security_scanner_asset', targetId: assetId, context: { engine: 'tenable-vm', profile: body.scanId, runId: scan.runId, addresses: scan.addresses } })
        return res.status(202).send({ run: scan })
    } catch (error) {
        return res.status(400).send({ error: errorMessage(error) })
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
    const finding = await updateUvmFinding({ findingId, status: body.status as UvmTriageStatus, note })
    if (!finding) return res.status(404).send({ error: 'Finding not found.' })
    await recordSystemEvent(req, { actionType: 'security_scanner.finding.triaged', actorId, targetType: 'security_scanner_finding', targetId: findingId, context: { status: finding.status, noteProvided: Boolean(note) } })
    return res.send({ finding })
}

export async function getUvmRun(req: FastifyRequest, res: FastifyReply) {
    if (!await requireHanasandInternalAccess(req, res)) return
    const { runId } = req.params as { runId: string }
    const scan = await getUvmNetworkRun(runId)
    if (!scan) return res.status(404).send({ error: 'Scan run not found.' })
    return res.send({ run: scan })
}

export async function postUvmRunCancel(req: FastifyRequest, res: FastifyReply) {
    const actorId = await requireHanasandInternalAccess(req, res)
    if (!actorId) return
    const { runId } = req.params as { runId: string }
    try {
        const scan = await cancelUvmRun(runId)
        if (!scan) return res.status(404).send({ error: 'Scan run not found.' })
        await recordSystemEvent(req, { actionType: 'security_scanner.execution.cancelled', actorId, targetType: 'security_scanner_run', targetId: runId, context: {} })
        return res.send({ run: scan })
    } catch (error) {
        return res.status(409).send({ error: errorMessage(error) })
    }
}

function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error) }
