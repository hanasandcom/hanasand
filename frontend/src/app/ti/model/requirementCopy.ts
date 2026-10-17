import { unique } from './evidenceValues'
import { rewriteSharedPublicLanguage } from '../sharedPublicLanguage'

export function displayRequirementText(value: string) {
    const domainText = value
        .replace(
            /\bAPT49 is an ambiguous label in open reporting\. Some sources map it to Tropic Trooper, a long-running Asia-Pacific espionage actor\. Malpedia and Cyberint map BlueHornet\/AgainstTheWest\/APT49 to a hacktivist and leak-focused persona\. The profile is split into both tracks until source-specific reporting makes the context clear\./gi,
            'APT49 is used for two tracks in open reporting: Tropic Trooper espionage reporting and BlueHornet/AgainstTheWest leak-claim reporting. Keep the tracks separate when reviewing attribution or company exposure.',
        )
        .replace(/\bAPT49 label collision requires analyst disambiguation\b/gi, 'APT49 naming has two reporting tracks')
        .replace(
            /\bOpen-source references disagree on whether APT49 should be treated as Tropic Trooper or BlueHornet\/AgainstTheWest\. The profile is therefore split into espionage-track and hacktivist\/leak-track monitoring until a source-specific claim resolves the context\./gi,
            'Open reporting maps APT49 to both Tropic Trooper and BlueHornet/AgainstTheWest. Review the source track before using it for attribution or company exposure.',
        )
        .replace(/\blabel collision\b/gi, 'shared-name profile')
        .replace(/\banalyst disambiguation\b/gi, 'source-track review')
        .replace(/\bHanasand resolves it as an alias-collision profile:/gi, 'Open reporting treats this as an alias-collision profile:')
        .replace(/\bHanasand resolves\b/gi, 'Open reporting maps')
        .replace(/\baction_required\b/gi, 'review')
        .replace(/\baction required\b/gi, 'review')
        .replace(/GET\s+\/api\/organizations\/[^/\s]+\/alert-readiness/gi, 'Check organization alert state')
        .replace(/GET\s+\/api\/organizations\/[^/\s]+\/alert-status/gi, 'Check organization alert state')
        .replace(/GET\s+\/api\/organizations\/[^/\s]+\/watchlists/gi, 'Open organization watchlists')
        .replace(/\/api\/organizations\/[^/\s]+\/alert-readiness/gi, 'organization alert state')
        .replace(/\/api\/organizations\/[^/\s]+\/alert-status/gi, 'organization alert state')
        .replace(/\/api\/organizations\/[^/\s]+\/watchlists/gi, 'organization watchlist action')
        .replace(/GET\s+\/api\/organizations\/:id\/alert-readiness/gi, 'Check org alert state')
        .replace(/GET\s+\/api\/organizations\/:id\/alert-status/gi, 'Check org alert state')
        .replace(/\/api\/organizations\/:id\/alert-readiness/gi, 'org alert state')
        .replace(/\/api\/organizations\/:id\/alert-status/gi, 'org alert state')
        .replace(/\/api\/findings\/alerts\/generation-readiness/gi, 'alert generation state')
        .replace(/\/api\/findings\/alerts\/generation-status/gi, 'alert generation state')
        .replace(/\/v1\/findings\/alerts\/generation-readiness/gi, 'alert generation state')
        .replace(/\/v1\/findings\/alerts\/generation-status/gi, 'alert generation state')
        .replace(/\/v1\/cases\/:caseId\/action-replay-export/gi, 'case action replay')
        .replace(/\/v1\/findings\/alerts\/rebuild/gi, 'alert rebuild')
        .replace(/\/v1\/findings\/watchlists/gi, 'watchlist update')
        .replace(/\/v1\/findings\/webhooks\/deliver/gi, 'webhook delivery')
        .replace(/\/v1\/cases/gi, 'case actions')
        .replace(/generatedAlertReferences/gi, 'generated alert references')
        .replace(/TiSearchResponse\.actorIntelligence\.malwareTools\/campaigns/gi, 'actor tooling and campaign fields')
        .replace(/actorIntelligence\.structuredProvenance\[\]\.reportDate/gi, 'source report date')
        .replace(/sourceProvenance\[\]\.sourceRequestId/gi, 'source request')
        .replace(/sourceProvenance\[\]\.captureId/gi, 'capture reference')
        .replace(/sourceProvenance\[\]\.sourceId/gi, 'source reference')
        .replace(/sourceProvenance\[\]\.provenance/gi, 'source reference')
        .replace(/relatedAlerts\[\]\.casePath/gi, 'alert case link')
        .replace(/relatedAlerts\[\]\.id/gi, 'alert review')
        .replace(/relatedCases\[\]\.path/gi, 'case link')
        .replace(/handoffs\.alertRebuild\.endpoint/gi, 'alert rebuild action')
        .replace(/sourceProvenance\[\]/gi, 'source evidence')
        .replace(new RegExp('pro' + 'venance', 'gi'), 'source reference')
        .replace(/actorIntelligence\./gi, 'actor intelligence ')
        .replace(/handoffs\./gi, '')
        .replace(/relatedAlerts\[\]/gi, 'related alerts')
    return rewriteSharedPublicLanguage(domainText, 'action status')
}

export function displayRequirementList(values: string[]) {
    return unique(values.map(displayRequirementText)).join('; ')
}
