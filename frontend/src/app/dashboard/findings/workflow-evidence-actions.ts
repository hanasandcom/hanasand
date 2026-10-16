import type { SyntheticEvent } from 'react'
import { alertRebuildFromWatchlistOrRequest, ingestPublicEvidence, postJson } from './workflow-http'
import { caseDetailPath, durableDeliveryRows, readNestedString, selectRebuiltAlert } from './workflow-values'
import { countTerms, ensureTerm, validEvidenceUrl } from './workflow-terms'
import { deliverySetupHref } from './workflow-route-summary'
import type { WorkflowActionContext } from './workflow-action-context'

export function createEvidenceActions(context: WorkflowActionContext, saveWatchlistTerms: (terms: string) => Promise<Awaited<ReturnType<typeof postJson>>>) {
    const { scope, organizationId, terms, setTerms, webhookUrl, webhookConfigured, claimActor, claimCompany, claimData, claimUrl, setClaimUrl, setBusyAction, setResult, setLastRoute, refreshWorkspace, navigateToCase } = context

    function readClaim() {
        return { actor: claimActor.trim(), company: claimCompany.trim(), claimedData: claimData.trim(), url: claimUrl.trim() }
    }

    function validateClaim(claim: ReturnType<typeof readClaim>) {
        if (claim.actor && claim.company && claim.claimedData && validEvidenceUrl(claim.url)) return true
        setResult({ ok: false, message: 'Actor, affected company, exposure details, and an HTTPS source URL are required.' })
        setBusyAction(null)
        return false
    }

    async function ingestPublicAdvisory(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusyAction('claim')
        setResult(null)
        const claim = readClaim()
        if (!validateClaim(claim)) return
        const nextTerms = ensureTerm(terms, claim.company)

        try {
            const ingest = await ingestPublicEvidence(claim, scope)
            if (!ingest.ok) throw new Error(ingest.message)
            const accepted = typeof ingest.accepted === 'number' ? ingest.accepted : 0
            if (!accepted) throw new Error('The source was not accepted. It must name the subject, describe a cyber incident, and publish a supported original timestamp.')
            const watchlist = await saveWatchlistTerms(nextTerms)
            if (!watchlist.ok) throw new Error(watchlist.message)
            const rebuild = await alertRebuildFromWatchlistOrRequest(watchlist, scope)
            const savedAlertCount = typeof rebuild.savedAlertCount === 'number' ? rebuild.savedAlertCount : 0
            setTerms(nextTerms)
            setClaimUrl('')
            setResult({ ok: rebuild.ok, message: rebuild.ok ? `Collected ${accepted} public incident report${accepted === 1 ? '' : 's'}. Matched ${savedAlertCount} alert${savedAlertCount === 1 ? '' : 's'}.` : rebuild.message })
            setLastRoute({ label: 'Metadata intake', watchTerms: countTerms(nextTerms), captureCount: accepted, alertCount: savedAlertCount })
            refreshWorkspace()
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    async function openCaseFromPublicAdvisory() {
        setBusyAction('claim-case')
        setResult(null)
        const claim = readClaim()
        if (!validateClaim(claim)) return
        const nextTerms = ensureTerm(terms, claim.company)

        try {
            const ingest = await ingestPublicEvidence(claim, scope)
            const accepted = typeof ingest.accepted === 'number' ? ingest.accepted : 0
            if (!accepted) throw new Error('The source was not accepted. It must name the subject, describe a cyber incident, and publish a supported original timestamp.')
            const watchlist = await saveWatchlistTerms(nextTerms)
            if (!watchlist.ok) throw new Error(watchlist.message)
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
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    return { ingestPublicAdvisory, openCaseFromPublicAdvisory }
}
