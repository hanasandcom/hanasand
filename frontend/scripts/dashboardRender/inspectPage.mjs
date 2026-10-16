import { collectContrastIssues } from './contrastSnapshot.mjs'
import { inspectPageContent } from './contentChecks.mjs'
import { captureDomSnapshot } from './domSnapshot.mjs'
import { inspectLayout } from './layoutChecks.mjs'
import { inspectReadiness } from './readinessChecks.mjs'

export async function inspectRenderedPage(page, spec, config) {
    const snapshot = await captureDomSnapshot(page, spec, config.expectedRows)
    snapshot.contrastIssues = await collectContrastIssues(page)
    const content = inspectPageContent(snapshot, spec, config)
    const readiness = inspectReadiness(snapshot, config.expectedRows)
    const layout = inspectLayout(snapshot)
    return {
        reasons: [...content.reasons, ...readiness.reasons, ...layout.reasons],
        selectorCounts: content.selectorCounts,
        overlapCount: layout.overlapCount,
        narrowActionCount: layout.narrowActionCount,
        clippedTextCount: layout.clippedTextCount,
        bannedCopyList: content.bannedCopyList,
        highContrastTokenHits: content.highContrastTokenHits,
        contrastIssues: content.contrastIssues,
        readinessRows: readiness.readinessRows,
    }
}
