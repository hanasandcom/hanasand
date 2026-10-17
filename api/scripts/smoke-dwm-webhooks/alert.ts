import { orgId, suffix } from './state.ts'

export function createAlert() {
    return {
        id: `alert_${suffix}`,
        organizationId: orgId,
        tenantId: orgId,
        orgName: 'Acme Security',
        company: 'Acme Security',
        severity: 'critical',
        claimSummary: 'A ransomware leak-site post claims Acme Security source archives were published.',
        recommendedAction: 'Validate the source, preserve evidence, notify the customer owner, and rotate affected credentials if confirmed.',
        matchedTerm: { value: 'acme-security.com', kind: 'domain' },
        sourceFamily: 'ransomware_leak_site',
        artifactType: 'victim_claim',
        route: 'customer_discord',
        dedupeKey: `dwm_dedupe_${suffix}`,
        casePath: `/dwm?alert=alert_${suffix}`,
        caseId: `case_${suffix}`,
        watchlist: {
            id: 'watchlist-acme',
            name: 'Acme customer watchlist',
            terms: ['acme-security.com', 'Acme Security'],
        },
        evidence: [
            { label: 'Leak-site claim', detail: 'Claim references Acme Security domain and source archive filenames.', source: 'collector', capturedAt: new Date().toISOString() },
        ],
        workflowContext: {
            organizationId: orgId,
            watchlistItemIds: ['watchlist-acme'],
            sourceFamily: 'ransomware_leak_site',
            evidenceCount: 1,
            dedupeKey: `dwm_dedupe_${suffix}`,
            recommendedRoute: 'customer_discord',
            caseIdCandidate: `case_${suffix}`,
            casePath: `/dwm?alert=alert_${suffix}`,
        },
        webhookContext: {
            alertId: `alert_${suffix}`,
            organizationId: orgId,
            watchlistItemIds: ['watchlist-acme'],
            sourceFamily: 'ransomware_leak_site',
            evidenceCount: 1,
            dedupeKey: `dwm_dedupe_${suffix}`,
            recommendedRoute: 'customer_discord',
            caseIdCandidate: `case_${suffix}`,
            casePath: `/dwm?alert=alert_${suffix}`,
        },
    }
}

export type SmokeAlert = ReturnType<typeof createAlert>
