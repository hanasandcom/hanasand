import type { TiSearchResponse } from '../../src/utils/ti/search'

export function apt29Result(): TiSearchResponse {
    return {
        query: 'APT29',
        generatedAt: '2026-06-29T00:00:00.000Z',
        mode: 'seeded',
        status: 'ready',
        runId: 'run_apt29_org_relevance',
        summary: 'APT29 has public reporting tied to Microsoft cloud and identity intrusions.',
        confidence: 0.86,
        lastSeen: '2026-06-01T00:00:00.000Z',
        aliases: ['Midnight Blizzard', 'Nobelium'],
        recentActivity: [{
            date: '2024-01-25',
            title: 'Microsoft disclosed Midnight Blizzard access to corporate email',
            detail: 'Microsoft reported access to corporate email accounts by Midnight Blizzard.',
            confidence: 0.84,
            sourceIds: ['src_microsoft_midnight_blizzard'],
            claimType: 'victim_claim',
            victimName: 'Microsoft corporate email accounts',
            affectedSectors: ['Technology and cloud services'],
            countries: ['United States'],
            impact: 'Cloud identity and email exposure.',
            firstReportedAt: '2024-01-25',
        }],
        targets: [{
            sector: 'Technology and cloud services',
            regions: ['United States'],
            rationale: 'Vendor reporting describes APT29 activity against corporate cloud and email systems.',
            confidence: 0.84,
        }],
        ttps: [{
            name: 'Valid Accounts',
            attackId: 'T1078',
            tactic: 'Initial Access',
            detail: 'Public reporting describes credential and token access paths.',
            confidence: 0.8,
        }],
        datasets: [],
        sources: [{
            id: 'src_microsoft_midnight_blizzard',
            name: 'Microsoft Threat Intelligence',
            type: 'vendor_disclosure',
            provenance: 'https://www.microsoft.com/en-us/security/blog/',
            url: 'https://www.microsoft.com/en-us/security/blog/',
        }],
        notes: [],
        actionability: {
            schemaVersion: 'ti.query.actionability.v1',
            alertDisposition: 'case_ready',
            shouldAlert: true,
            watchlistCandidates: [{
                kind: 'domain',
                value: 'microsoft.com',
                reason: 'Microsoft is directly named in the actor evidence.',
                confidence: 0.84,
            }],
            watchlistMatches: [{
                tenantId: 'tenant_acme',
                organizationId: 'org_acme',
                watchlistId: 'watchlist_acme_vendors',
                watchlistItemId: 'item_microsoft',
                kind: 'domain',
                value: 'microsoft.com',
                route: '/findings/watchlists/watchlist_acme_vendors',
                casePath: '/cases/case_apt29_microsoft',
            }],
            relatedAlerts: [{
                id: 'alert_apt29_microsoft',
                title: 'APT29 public reporting matched microsoft.com watchlist item',
                status: 'open',
                severity: 'high',
                caseIdCandidate: 'case_apt29_microsoft',
                casePath: '/cases/case_apt29_microsoft',
                tenantId: 'tenant_acme',
                organizationId: 'org_acme',
                captureIds: ['capture_microsoft_apt29_2024'],
                webhookDestinationIds: ['webhook_security_ops'],
            }],
            relatedCases: [{
                id: 'case_apt29_microsoft',
                title: 'APT29 Microsoft vendor exposure review',
                status: 'open',
                priority: 'high',
                path: '/cases/case_apt29_microsoft',
            }],
            sourceProvenance: [{
                sourceId: 'src_microsoft_midnight_blizzard',
                sourceName: 'Microsoft Threat Intelligence',
                provenance: 'https://www.microsoft.com/en-us/security/blog/',
                captureId: 'capture_microsoft_apt29_2024',
                confidence: 0.84,
            }],
            enrichmentGaps: [],
            handoffs: {
                watchlist: {
                    method: 'POST',
                    endpoint: '/v1/dwm/watchlists',
                    payloads: [{ kind: 'domain', value: 'microsoft.com', notes: 'APT29: Microsoft vendor exposure.' }],
                    missing: [],
                },
                alertRebuild: {
                    method: 'POST',
                    endpoint: '/v1/dwm/alerts/rebuild',
                    missing: [],
                },
                caseCreate: {
                    method: 'POST',
                    endpoint: '/v1/cases',
                    payload: {
                        alertId: 'alert_apt29_microsoft',
                        title: 'APT29 Microsoft vendor exposure review',
                        priority: 'high',
                    },
                    missing: [],
                },
                webhookDelivery: {
                    method: 'POST',
                    endpoint: '/v1/dwm/webhooks/deliver',
                    payload: {
                        alertId: 'alert_apt29_microsoft',
                        destinationId: 'webhook_security_ops',
                    },
                    missing: [],
                },
            },
        },
        actorIntelligence: {
            actorClass: 'State-linked espionage actor',
            attribution: 'Russia-linked SVR/APT29 activity in public government and vendor reporting',
            firstSeen: 'Late-2000s public reporting',
            lastSeen: '2026-06-01T00:00:00.000Z',
            motivation: ['Strategic intelligence collection'],
            targetSectors: ['Technology and cloud services'],
            geographies: ['United States'],
            confidence: 0.86,
            confidenceReasoning: ['Microsoft vendor reporting and government advisories support this actor profile.'],
            sourceProvenance: ['https://www.microsoft.com/en-us/security/blog/'],
            businessModel: {
                schemaVersion: 'ti.actor.business_model.v1',
                evidenceState: 'observed_mechanisms',
                publicationStrategies: [{ value: 'public victim listing', assertionKind: 'observed', confidence: 0.9, sourceIds: ['src_microsoft_midnight_blizzard'], captureIds: ['capture_microsoft_apt29_2024'], reviewState: 'unreviewed', reviewReasons: [] }],
                publicityTactics: [],
                pressureTactics: [],
                communicationChannels: [],
                buyerSellerCommunications: [],
                intermediaryCommunications: [],
                monetizationPaths: [],
                profitabilitySignals: [],
                missingEvidence: ['payments or conversion'],
                evidenceBoundary: 'Observed publication mechanisms do not establish payments or profit.',
            },
            structuredProvenance: [{
                sourceId: 'src_microsoft_midnight_blizzard',
                sourceName: 'Microsoft Threat Intelligence',
                provenance: 'https://www.microsoft.com/en-us/security/blog/',
                reportDate: '2024-01-25',
                captureId: 'capture_microsoft_apt29_2024',
                confidence: 0.84,
                shownBecause: 'Microsoft is a matched customer vendor and the disclosure names Midnight Blizzard activity.',
            }],
        },
    }
}
export function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message)
}

export function readObject(value: unknown): Record<string, unknown> {
    assert(Boolean(value) && typeof value === 'object' && !Array.isArray(value), 'Expected object value.')
    return value as Record<string, unknown>
}

export function readArray(value: unknown): unknown[] {
    assert(Array.isArray(value), 'Expected array value.')
    return value
}
