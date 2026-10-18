import type { SyntheticEvent } from 'react'
import { alertRebuildFromWatchlistOrRequest, ingestPublicEvidence, postJson } from './workflow-http'
import { caseDetailPath, durableDeliveryRows, readNestedString, selectRebuiltAlert } from './workflow-values'
import { countTerms, ensureTerm, validEvidenceUrl } from './workflow-terms'
import { deliverySetupHref } from './workflow-route-summary'
import type { WorkflowActionContext } from './workflow-action-context'
import { runWorkflowAction } from './workflow-action-lifecycle'

export function createEvidenceActions(context: WorkflowActionContext, saveWatchlistTerms: (terms: string) => Promise<Awaited<ReturnType<typeof postJson>>>) {
    const { scope, organizationId, terms, setTerms, webhookUrl, webhookConfigured, claimActor, claimCompany, claimData, claimUrl, setClaimUrl, setResult, setLastRoute, refreshWorkspace, navigateToCase } = context

    function readClaim() {
        return { actor: claimActor.trim(), company: claimCompany.trim(), claimedData: claimData.trim(), url: claimUrl.trim() }
    }

    function validateClaim(claim: ReturnType<typeof readClaim>) {
        if (claim.actor && claim.company && claim.claimedData && validEvidenceUrl(claim.url)) return true
        setResult({ ok: false, message: 'Actor, affected company, exposure details, and an HTTPS source URL are required.' })
        return false
    }

    async function preparePublicEvidence() {
        const claim = readClaim()
        if (!validateClaim(claim)) return null

        const nextTerms = ensureTerm(terms, claim.company)
        const ingest = await ingestPublicEvidence(claim, scope)
        if (!ingest.ok) throw new Error(ingest.message)
        const accepted = typeof ingest.accepted === 'number' ? ingest.accepted : 0
        if (!accepted) throw new Error('The source was not accepted. It must name the subject, describe a cyber incident, and publish a supported original timestamp.')

        const watchlist = await saveWatchlistTerms(nextTerms)
        if (!watchlist.ok) throw new Error(watchlist.message)
        return { claim, nextTerms, accepted, watchlist }
    }

    async function ingestPublicAdvisory(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        await runWorkflowAction(context, 'claim', async () => {
            const prepared = await preparePublicEvidence()
            if (!prepared) return
            const { nextTerms, accepted, watchlist } = prepared
            const rebuild = await alertRebuildFromWatchlistOrRequest(watchlist, scope)
            const savedAlertCount = typeof rebuild.savedAlertCount === 'number' ? rebuild.savedAlertCount : 0
            setTerms(nextTerms)
            setClaimUrl('')
            setResult({ ok: rebuild.ok, message: rebuild.ok ? `Collected ${accepted} public incident report${accepted === 1 ? '' : 's'}. Matched ${savedAlertCount} alert${savedAlertCount === 1 ? '' : 's'}.` : rebuild.message })
            setLastRoute({ label: 'Metadata intake', watchTerms: countTerms(nextTerms), captureCount: accepted, alertCount: savedAlertCount })
            refreshWorkspace()
        })
    }

    async function openCaseFromPublicAdvisory() {
        await runWorkflowAction(context, 'claim-case', async () => {
            const prepared = await preparePublicEvidence()
            if (!prepared) return
            const { claim, nextTerms, accepted } = prepared
            const rebuild = await postJson('/api/findings/alerts/rebuild', scope)
            if (!rebuild.ok) throw new Error(rebuild.message)
            const alert = selectRebuiltAlert(rebuild, claim.company, nextTerms)
            if (!alert?.id) throw new Error('No matching event was found in this evidence.')
            const casePayload = await postJson(`/api/findings/alerts/${encodeURIComponent(alert.id)}/case-handoff`, {
                ...scope, actor: 'dashboard', note: `Case opened from public incident evidence for ${claim.company}.`,
                idempotencyKey: `dashboard-public-advisory-case:${alert.id}`,
            })
            if (!casePayload.ok) throw new Error(casePayload.message)
            const caseId = readNestedString(casePayload, ['case', 'id']) || readNestedString(casePayload, ['alertCaseHandoff', 'caseId'])
            if (!caseId) throw new Error('No durable case was returned.')
            const delivery = webhookConfigured ? await postJson('/api/findings/webhooks/deliver', {
                ...scope, alertId: alert.id, caseId, limit: 1, dryRun: true, webhookUrl: webhookUrl.trim(), attachToWatchlist: true,
            }) : null
            let deliveryText = ''
            let deliveryAttempts = 0
            let deliveryReady = false
            if (delivery) {
                if (!delivery.ok) throw new Error(delivery.message)
                const rows = durableDeliveryRows(delivery)
                if (!rows.length) throw new Error('No durable delivery result was returned.')
                deliveryAttempts = rows.length
                deliveryReady = rows.some(row => row.status === 'delivered' && row.dryRun !== true)
                deliveryText = deliveryReady ? ' Delivery delivered.' : ' Dry-run delivery recorded; no customer notification was sent.'
            }
            setTerms(nextTerms)
            setClaimUrl('')
            setLastRoute({ label: 'Metadata case', watchTerms: countTerms(nextTerms), captureCount: accepted, alertCount: 1, alertId: alert.id, caseId, caseHref: caseDetailPath(caseId, alert.id, organizationId, 'public_advisory'), deliveryAttempts: deliveryText ? deliveryAttempts : undefined, deliveryState: deliveryText ? (deliveryReady ? 'delivered' : 'dry-run recorded') : undefined })
            setResult({ ok: !webhookConfigured || deliveryReady, message: `Collected ${accepted} public incident report${accepted === 1 ? '' : 's'}, opened ${caseId}.${deliveryText}`, actionHref: deliveryText && !deliveryReady ? deliverySetupHref(organizationId) : undefined, actionLabel: deliveryText && !deliveryReady ? 'Configure delivery' : undefined })
            navigateToCase(caseDetailPath(caseId, alert.id, organizationId, 'public_advisory'))
        })
    }

    return { ingestPublicAdvisory, openCaseFromPublicAdvisory }
}
