import type { WorkbenchCase, WorkbenchOrgContext, OperatorActionRailRow, WorkbenchPublicTiHandoff, WorkbenchHandoffAction, WorkbenchPublicTiActionReadiness, WorkbenchWorkflowStep, HandoffTerm } from '../types'
import { label } from './presentation'
import { inferTermKind } from './watchlistHelpers'
import { scopeBody } from './actionMessages'

export function relatedLinkHref(selected: WorkbenchCase, label: string) {
    return selected.relatedLinks.find(link => link.label === label)?.href
}

export function handoffActionRailRows(selected: WorkbenchCase, orgContext: WorkbenchOrgContext | undefined): OperatorActionRailRow[] {
    const handoff = selected.handoff as WorkbenchPublicTiHandoff
    if (handoff.decodeStatus === 'blocked') {
        return [{
            id: 'malformed_public_ti_handoff',
            label: 'Actor evidence bridge syncing',
            detail: handoff.decodeError || 'The handoff payload could not be decoded.',
            tone: 'blocked',
            copyPayload: handoff,
        }]
    }

    const orgMissing = !orgContext?.organization
    const activeWebhook = orgContext?.webhookDestinations.find(item => item.status === 'active')
    const sourceCoverage = orgContext?.readiness.sourceCoverage
    const watchlistReadiness = handoffReadinessFor(handoff, 'create_watchlist')
    const rebuildReadiness = handoffReadinessFor(handoff, 'rebuild_alerts')
    const caseReadiness = handoffReadinessFor(handoff, 'open_case')
    const enrichmentReadiness = handoffReadinessFor(handoff, 'queue_enrichment')
    const rows: OperatorActionRailRow[] = []
    const watchlistPayload = handoff.actionPayloads?.watchlist || handoff.selectedPayload
    const watchTerms = handoffTerms(handoff)
    const watchlistDisabledReason = readinessDisabledReason(watchlistReadiness)
        || (orgMissing ? 'Select an organization before saving actor evidence actions.' : !watchTerms.length ? 'Actor evidence has no watchlist term yet.' : undefined)
    rows.push({
        id: 'handoff_watchlist',
        label: 'Add org watchlist term',
        detail: readinessDetail(watchlistReadiness, watchTerms.length ? watchTerms.map(term => `${term.kind || inferTermKind(term.value)}:${term.value}`).join(', ') : 'Watchlist term is syncing from the selected handoff.'),
        tone: readinessTone(watchlistReadiness, orgMissing || !watchTerms.length ? 'blocked' : 'ready'),
        action: {
            id: 'public_ti_create_watchlist',
            label: 'Add term',
            method: 'POST',
            href: '/api/findings/watchlists',
            body: {
                ...scopeBody(orgContext),
                name: typeof watchlistPayload?.body?.name === 'string' ? watchlistPayload.body.name : `${handoff.query || selected.title} watchlist`,
                terms: watchTerms,
                status: 'active',
                webhookDestinationId: activeWebhook?.id,
                publicTiHandoff: handoffEnvelope(handoff),
            },
            disabledReason: watchlistDisabledReason,
        },
        disabledReason: watchlistDisabledReason,
    })
    const rebuildDisabledReason = readinessDisabledReason(rebuildReadiness)
        || (orgMissing
            ? 'Public TI alert rebuild requires selected organization context.'
            : !sourceCoverage ? 'Alert rebuild is reading source coverage.'
                : !orgContext?.readiness.activeWatchlistCount ? 'Create an active organization watchlist before rebuilding alerts.' : undefined)
    rows.push({
        id: 'handoff_rebuild',
        label: 'Rebuild alerts',
        detail: readinessDetail(rebuildReadiness, sourceCoverage ? `${sourceCoverage.activeSourceCount}/${sourceCoverage.sourceCount} active sources; ${orgContext?.readiness.liveAlertCount ?? 0} saved alerts in queue.` : 'Alert rebuild is reading source coverage.'),
        tone: readinessTone(rebuildReadiness, orgMissing || !sourceCoverage || !orgContext?.readiness.activeWatchlistCount ? 'blocked' : 'ready'),
        action: {
            id: 'public_ti_rebuild_alerts',
            label: 'Rebuild',
            method: 'POST',
            href: '/api/findings/alerts/rebuild',
            body: { ...scopeBody(orgContext), publicTiHandoff: handoffEnvelope(handoff), watchTerms },
            disabledReason: rebuildDisabledReason,
        },
        disabledReason: rebuildDisabledReason,
    })
    const casePayload = handoff.actionPayloads?.case || handoff.selectedPayload
    const caseDisabledReason = readinessDisabledReason(caseReadiness)
        || (orgMissing ? 'Public TI case creation requires selected organization context.' : casePayload?.blocked ? (casePayload.missing || handoff.missing).join('; ') : undefined)
    rows.push({
        id: 'handoff_case',
        label: 'Open selected case',
        detail: readinessDetail(caseReadiness, handoff.missing.length ? handoff.missing.join('; ') : 'Create or reopen a backed analyst case from the handoff payload.'),
        tone: readinessTone(caseReadiness, orgMissing || casePayload?.blocked ? 'blocked' : 'ready'),
        action: {
            id: 'public_ti_open_case',
            label: 'Open case',
            method: 'POST',
            href: '/api/cases',
            body: { ...scopeBody(orgContext), ...(casePayload?.body || {}), sourceType: 'public_ti', sourceId: handoff.artifactId, publicTiHandoff: handoffEnvelope(handoff), reopen: true },
            disabledReason: caseDisabledReason,
        },
        copyPayload: casePayload?.blocked ? handoff : undefined,
        disabledReason: caseDisabledReason,
    })
    rows.push(activeWebhook && orgContext?.organization ? {
        id: 'handoff_webhook',
        label: 'Test webhook',
        detail: `${activeWebhook.name} (${activeWebhook.id}); last test ${activeWebhook.lastTestStatus || 'checking'}.`,
        tone: activeWebhook.lastTestStatus === 'failed' ? 'blocked' : 'ready',
        action: {
            id: 'public_ti_test_org_webhook',
            label: 'Test',
            method: 'POST',
            href: `/api/organizations/${encodeURIComponent(orgContext.organization.id)}/webhooks/test`,
            body: { webhookDestinationId: activeWebhook.id, dryRun: true, publicTiHandoff: handoffEnvelope(handoff) },
        },
    } : {
        id: 'handoff_webhook_blocked',
        label: 'Configure/test webhook',
        detail: 'Add an active organization webhook destination before sending alerts.',
        tone: 'needs_action',
        href: '/automation?setup=dwm',
    })
    rows.push({
        id: 'handoff_source',
        label: handoff.sourceRequired ? 'Request source pack' : 'Source health',
        detail: readinessDetail(enrichmentReadiness, sourceCoverage ? `${sourceCoverage.activeSourceCount}/${sourceCoverage.sourceCount} active sources. ${handoff.sourceRequests.length} source request(s) in handoff.` : 'Open collection to attach source-pack changes for this handoff.'),
        tone: readinessTone(enrichmentReadiness, sourceCoverage?.activeSourceCount ? 'ready' : 'blocked'),
        href: enrichmentReadiness?.backedRoute || '/ti/sources',
        copyPayload: handoff.sourceRequired || !sourceCoverage || enrichmentReadiness?.ready === false ? handoff : undefined,
        disabledReason: readinessDisabledReason(enrichmentReadiness),
    })
    rows.push({ id: 'handoff_copy', label: 'Exact handoff', detail: `${handoff.action || 'public TI'} payload for ${handoff.artifact?.label || handoff.artifactId || selected.title}.`, tone: 'ready', copyPayload: handoff })
    return rows
}

export function handoffReadinessFor(handoff: WorkbenchPublicTiHandoff, action: WorkbenchHandoffAction): WorkbenchPublicTiActionReadiness | undefined {
    return handoff.actionReadiness?.find(item => item.action === action)
}

export function readinessDisabledReason(readiness: WorkbenchPublicTiActionReadiness | undefined) {
    if (!readiness || readiness.ready) return undefined
    return [
        readiness.blockerCodes.length ? `Needs setup: ${readiness.blockerCodes.join(', ')}.` : '',
        readiness.missing.length ? readiness.missing.join('; ') : '',
    ].filter(Boolean).join(' ') || 'Public TI action context is syncing.'
}

export function readinessDetail(readiness: WorkbenchPublicTiActionReadiness | undefined, fallback: string) {
    if (!readiness) return fallback
    const route = readiness.backedRoute || readiness.endpoint || readiness.route
    const sourceRequests = readiness.sourceRequestCount ? `; ${readiness.sourceRequestCount} source request${readiness.sourceRequestCount === 1 ? '' : 's'}` : ''
    return `${fallback} Status: ${readiness.ready ? 'ready' : 'checking'}${route ? ` through ${route}` : ''}${sourceRequests}.`
}

export function readinessTone(readiness: WorkbenchPublicTiActionReadiness | undefined, fallback: WorkbenchWorkflowStep['status']): WorkbenchWorkflowStep['status'] {
    if (!readiness) return fallback
    return readiness.ready ? 'ready' : 'blocked'
}

export function handoffTerms(handoff: WorkbenchPublicTiHandoff): HandoffTerm[] {
    const fromArtifact = handoff.artifact?.watchlistTerms || []
    const fromPayload = Array.isArray(handoff.actionPayloads?.watchlist?.body?.terms) ? handoff.actionPayloads?.watchlist?.body?.terms : []
    return [...fromArtifact, ...fromPayload]
        .flatMap((term): HandoffTerm[] => {
            if (!term || typeof term !== 'object') return []
            const value = 'value' in term ? String(term.value || '').trim() : ''
            if (!value) return []
            return [{
                value,
                kind: 'kind' in term && typeof term.kind === 'string' ? term.kind : inferTermKind(value),
                notes: 'notes' in term && typeof term.notes === 'string' ? term.notes : undefined,
            }]
        })
        .filter((term, index, values) => values.findIndex(candidate => candidate.value.toLowerCase() === term.value.toLowerCase()) === index)
}

export function handoffEnvelope(handoff: WorkbenchPublicTiHandoff) {
    return {
        source: 'public-ti',
        action: handoff.action,
        artifactId: handoff.artifactId,
        query: handoff.query,
        generatedAt: handoff.generatedAt,
    }
}
