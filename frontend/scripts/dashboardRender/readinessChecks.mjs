export function inspectReadiness(snapshot, expectedRows) {
    const reasons = []
    const readinessRows = {}
    if (snapshot.pathname !== '/dashboard') return { reasons, readinessRows }
    if (snapshot.mobileSidebarVisible) reasons.push('mobile dashboard renders expanded navigation before the workbench')
    if (!snapshot.detail) {
        reasons.push('missing readiness detail panel')
    } else {
        for (const attribute of ['owner', 'action', 'workflow-blocker', 'customer-impact', 'source-reference', 'contract', 'href']) {
            if (!snapshot.detail[`data-readiness-detail-${attribute}`]) reasons.push(`readiness detail missing data-readiness-detail-${attribute}`)
        }
        if (snapshot.detail['data-readiness-detail-state'] !== 'ready' && !snapshot.detail['data-readiness-detail-blocker']) reasons.push('readiness detail missing blocker')
        const actionCount = Number(snapshot.detail['data-readiness-detail-action-count'])
        if (!actionCount || Number.isNaN(actionCount)) reasons.push('readiness detail missing backed actions')
    }
    for (const [id, href] of Object.entries(expectedRows)) {
        const row = snapshot.readinessRows[id]
        if (!row) {
            reasons.push(`missing readiness row: ${id}`)
            readinessRows[id] = { present: false }
            continue
        }
        const state = row['data-readiness-state'] || ''
        const blockerCountText = row['data-readiness-blocker-count']
        const blockerCount = Number(blockerCountText)
        const deepLinkTarget = row['data-readiness-deep-link-target'] || ''
        const ownerLane = row['data-readiness-owner-lane'] || ''
        const operatorAction = row['data-readiness-operator-action'] || ''
        const workflowBlocker = row['data-readiness-workflow-blocker'] || ''
        const customerImpact = row['data-readiness-customer-impact'] || ''
        const evidenceProvenance = row['data-readiness-source-reference'] || row['data-readiness-provenance'] || ''
        const actionCountText = row['data-readiness-action-count']
        const actionCount = Number(actionCountText)
        const unavailableReason = row['data-readiness-unavailable-reason'] || ''
        const proofTimestamp = row['data-readiness-checked-at'] || row['data-readiness-proof-timestamp'] || ''
        const staleAfterSecondsText = row['data-readiness-stale-after-seconds']
        const staleAfterSeconds = Number(staleAfterSecondsText)
        const expectedDashboardRowId = row['data-readiness-expected-dashboard-row-id'] || ''
        const integrationProbeHint = row['data-readiness-integration-probe-hint'] || ''
        const backendProofContractVersion = row['data-readiness-backend-contract-version'] || row['data-readiness-backend-proof-contract-version'] || ''
        readinessRows[id] = { present: true, state, blockerCount, deepLinkTarget, ownerLane, operatorAction, workflowBlocker, customerImpact, evidenceProvenance, actionCount, unavailableReason, proofTimestamp, staleAfterSeconds, expectedDashboardRowId, integrationProbeHint, backendProofContractVersion }
        if (deepLinkTarget !== href) reasons.push(`bad deep-link target for ${id}: ${deepLinkTarget}`)
        if (!ownerLane) reasons.push(`missing owner lane for ${id}`)
        if (!operatorAction) reasons.push(`missing operator action for ${id}`)
        if (!workflowBlocker) reasons.push(`missing workflow blocker for ${id}`)
        if (!customerImpact) reasons.push(`missing customer impact for ${id}`)
        if (!evidenceProvenance) reasons.push(`missing evidence provenance for ${id}`)
        if (actionCountText === null || Number.isNaN(actionCount) || actionCount <= 0) reasons.push(`missing backed actions for ${id}`)
        if (blockerCountText === null || Number.isNaN(blockerCount)) reasons.push(`missing blocker count for ${id}`)
        if (!row['data-readiness-priority']) reasons.push(`missing readiness priority for ${id}`)
        if (!proofTimestamp) reasons.push(`missing proof timestamp for ${id}`)
        if (staleAfterSecondsText === null || Number.isNaN(staleAfterSeconds) || staleAfterSeconds <= 0) reasons.push(`missing stale threshold for ${id}`)
        if (expectedDashboardRowId !== id) reasons.push(`bad expected dashboard row id for ${id}: ${expectedDashboardRowId}`)
        if (!integrationProbeHint) reasons.push(`missing integration probe hint for ${id}`)
        if (!backendProofContractVersion) reasons.push(`missing backend proof contract version for ${id}`)
        if (state === 'ready' && blockerCount !== 0) reasons.push(`ready row has blockers: ${id}`)
        if (['blocked', 'needs_action', 'unavailable'].includes(state)) reasons.push(`customer-facing dead-end readiness state for ${id}: ${state}`)
        if (state !== 'ready' && !unavailableReason) reasons.push(`non-ready row missing reason: ${id}`)
        if (!row.className.includes('border-[#27364f]')) reasons.push(`missing muted dark border class for ${id}`)
    }
    return { reasons, readinessRows }
}
