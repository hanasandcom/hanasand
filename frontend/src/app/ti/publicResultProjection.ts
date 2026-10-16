import type { TiSearchResponse } from '@/utils/ti/search'
import { sanitizeActorIntelligence, sanitizeActorBusinessFinding } from './publicResultActor'
import { sanitizeActionability } from './publicResultActionability'
import { publicTiText, sanitizeBackendShapedPublicText } from './publicResultText'

export function projectPublicResult(result: TiSearchResponse): TiSearchResponse {

    const publicResult: TiSearchResponse = {
        query: result.query,
        queryKind: result.queryKind,
        generatedAt: result.generatedAt,
        mode: result.mode,
        cacheStatus: result.cacheStatus,
        status: result.status,
        refreshAfterSeconds: result.refreshAfterSeconds,
        summary: result.summary,
        confidence: result.confidence,
        lastSeen: result.lastSeen,
        aliases: result.aliases,
        recentActivity: result.recentActivity.map(item => ({
            date: item.date,
            title: item.title,
            detail: item.detail,
            confidence: item.confidence,
            sourceIds: item.sourceIds,
            url: item.url,
            claimType: item.claimType,
            victimName: item.victimName,
            affectedSectors: item.affectedSectors,
            countries: item.countries,
            impact: item.impact,
            firstReportedAt: item.firstReportedAt,
            lastReportedAt: item.lastReportedAt,
            publisherCount: item.publisherCount,
            corroboratingSourceIds: item.corroboratingSourceIds,
            contradictingSourceIds: item.contradictingSourceIds,
            assertionKind: item.assertionKind,
            reviewState: item.reviewState,
            corroborationState: item.corroborationState,
            observationSummary: item.observationSummary ? publicTiText(item.observationSummary) : undefined
        })),
        claims: result.claims?.map(claim => ({
            ...claim,
            summary: claim.summary ? publicTiText(claim.summary) : undefined,
            uncertaintyReasons: claim.uncertaintyReasons.map(publicTiText)
        })),
        incidents: result.incidents?.map(incident => ({
            ...incident,
            title: publicTiText(incident.title),
            summary: incident.summary ? publicTiText(incident.summary) : undefined,
            reviewReasons: incident.reviewReasons.map(publicTiText)
        })),
        evidenceAssessment: result.evidenceAssessment ? {
            ...result.evidenceAssessment,
            reasons: result.evidenceAssessment.reasons.map(publicTiText),
            missingFields: result.evidenceAssessment.missingFields.map(publicTiText)
        } : undefined,
        targets: result.targets,
        ttps: result.ttps,
        datasets: result.datasets,
        sources: result.sources.map(source => ({
            id: source.id,
            name: source.name,
            type: source.type,
            provenance: source.provenance ? publicTiText(source.provenance) : undefined,
            url: source.url,
            captureId: source.captureId,
            sourceRequestId: source.sourceRequestId,
            sourceFamily: source.sourceFamily,
            parserStatus: source.parserStatus,
            reportDate: source.reportDate,
            lastCollectedAt: source.lastCollectedAt
        })),
        notes: result.notes,
        actorIdentity: result.actorIdentity ? {
            catalogMatched: result.actorIdentity.catalogMatched,
            ambiguous: result.actorIdentity.ambiguous,
            activityEvidenceAvailable: result.actorIdentity.activityEvidenceAvailable,
            candidates: result.actorIdentity.candidates.map(candidate => ({
                catalogId: candidate.catalogId,
                externalId: candidate.externalId,
                canonicalName: publicTiText(candidate.canonicalName),
                description: candidate.description ? publicTiText(candidate.description) : undefined,
                referenceSources: candidate.referenceSources?.map(source => ({ name: publicTiText(source.name), url: source.url })),
                associatedNames: candidate.associatedNames.map(publicTiText),
                matchKinds: candidate.matchKinds,
                status: candidate.status,
                aptNumberDesignationPresent: candidate.aptNumberDesignationPresent,
                sourceUrl: candidate.sourceUrl,
                createdAt: candidate.createdAt,
                modifiedAt: candidate.modifiedAt,
                catalogVersion: candidate.catalogVersion,
                catalogModifiedAt: candidate.catalogModifiedAt,
                captureId: candidate.captureId,
            }))
        } : undefined,
        actorIntelligence: sanitizeActorIntelligence(result.actorIntelligence),
        actorCaseStudies: result.actorCaseStudies ? {
            ...result.actorCaseStudies,
            qualification: publicTiText(result.actorCaseStudies.qualification),
            cases: result.actorCaseStudies.cases.map(caseStudy => ({
                ...caseStudy,
                actor: publicTiText(caseStudy.actor),
                categories: caseStudy.categories.map(publicTiText),
                reviewStates: caseStudy.reviewStates.map(publicTiText),
                findings: caseStudy.findings?.map(sanitizeActorBusinessFinding),
            })),
            reviewedFindings: result.actorCaseStudies.reviewedFindings?.map(sanitizeActorBusinessFinding),
            pendingFindings: result.actorCaseStudies.pendingFindings?.map(sanitizeActorBusinessFinding),
            missingContexts: result.actorCaseStudies.missingContexts.map(publicTiText),
        } : undefined,
        actionability: sanitizeActionability(result.actionability),
        analystLoop: result.analystLoop ? {
            resultState: result.analystLoop.resultState,
            headline: result.analystLoop.headline,
            nextSteps: result.analystLoop.nextSteps,
            runStatusClarity: {
                reviewTasks: result.analystLoop.runStatusClarity.reviewTasks,
                rejectedSources: result.analystLoop.runStatusClarity.rejectedSources,
                blockedUnsafeTargets: result.analystLoop.runStatusClarity.blockedUnsafeTargets,
                meaningfulWorkCount: result.analystLoop.runStatusClarity.meaningfulWorkCount,
                queuedTasks: 0,
                summary: result.analystLoop.runStatusClarity.summary
            },
            metadataReviewInbox: result.analystLoop.metadataReviewInbox.map(item => ({
                id: item.id,
                company: item.company,
                victim: item.victim,
                affectedAccounts: item.affectedAccounts,
                accountSubjects: item.accountSubjects,
                datasetSize: item.datasetSize,
                actorStatement: item.actorStatement,
                claimedDate: item.claimedDate,
                sourceHash: item.sourceHash,
                confidence: item.confidence,
                status: item.status,
                allowedActions: item.allowedActions
            })),
            sourceActivationWorkflow: result.analystLoop.sourceActivationWorkflow,
            victimNotificationPacket: result.analystLoop.victimNotificationPacket
        } : undefined,
        collectionStrategy: result.collectionStrategy ? {
            thesis: publicTiText(result.collectionStrategy.thesis),
            productFocus: result.collectionStrategy.productFocus.map(publicTiText),
            sourcePosture: result.collectionStrategy.sourcePosture
                .filter(source => source.role !== 'rejected_paid_rows')
                .map(source => ({
                    source: publicTiText(source.source),
                    role: source.role,
                    summary: publicTiText(source.summary),
                    buyerValue: publicTiText(source.buyerValue)
                })),
            ownedCollection: {
                priority: result.collectionStrategy.ownedCollection.priority,
                summary: publicTiText(result.collectionStrategy.ownedCollection.summary),
                requirements: result.collectionStrategy.ownedCollection.requirements.map(publicTiText),
                prohibited: []
            },
            distribution: result.collectionStrategy.distribution
        } : undefined
    }

    return sanitizeBackendShapedPublicText(publicResult)
}
