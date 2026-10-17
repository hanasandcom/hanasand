import type { WorkbenchCase } from './ti/workbench/workbenchClient'
import { sourceGrowthDetail } from '@/utils/productProgress/readinessDetails'
import { sourceWorkerProofSummary } from '@/utils/productProgress/readinessDetails'
import type { ReadinessCaseContext } from './readinessCaseContext'
import { visibleChecks } from '@/utils/productProgress/readinessLabels'
import { readinessCase } from './readinessCaseFactory'

export function buildSourceWorkerReadinessCase(context: ReadinessCaseContext): WorkbenchCase {
    const { sourceGrowth, sourceWorkerReady, sourceWorkerCheckedAt, sourceWorkerBlockers, path } = context
    return readinessCase({
        id: 'source_worker_readiness',
        kind: 'source_readiness',
        queue: 'Source worker',
        title: sourceWorkerReady ? 'Source worker lane active' : 'Open source worker lane',
        severity: sourceWorkerReady ? 'medium' : 'high',
        status: sourceGrowth.status,
        priority: sourceWorkerReady ? 244 : 358,
        confidence: sourceWorkerReady ? 89 : 66,
        subtitle: sourceGrowth.detail || sourceGrowthDetail(sourceGrowth),
        recommendedAction: sourceWorkerReady
            ? 'Open Collection, inspect worker status, then rerun alert generation for the selected organization.'
            : 'Open Collection and review worker, inventory, customer configuration, and reachability checks before treating alert generation as ready.',
        evidence: [{
            id: 'ev_source_worker_readiness',
            sourceName: 'Source worker status',
            sourceFamily: 'source health',
            captureMode: 'operator view',
            redactionState: 'customer safe',
            contentHash: sourceGrowth.backendProofContractVersion || sourceGrowth.schemaVersion,
            excerpt: sourceWorkerProofSummary(sourceGrowth, sourceWorkerBlockers, sourceWorkerReady),
            observedAt: sourceWorkerCheckedAt,
            provenance: sourceGrowth.source || 'TI source worker',
            confidence: sourceWorkerReady ? 89 : 66,
        }],
        timeline: [{
            id: 'source_worker_readiness_at',
            at: sourceWorkerCheckedAt,
            title: sourceWorkerReady ? 'Source worker ready' : 'Source worker checking',
            body: sourceWorkerProofSummary(sourceGrowth, sourceWorkerBlockers, sourceWorkerReady),
        }],
        nextTasks: sourceWorkerReady
            ? ['Owner: collection. Inspect source worker status in Collection.', 'Confirm source lookup and safety checks before alert rebuild.', 'Return to alerts after source worker data stays fresh.']
            : ['Owner: collection. Open Collection.', 'Review source inventory, source-pack, lookup, worker, and reachability checks.', 'Refresh source status after the source data is operator-reachable.'],
        relatedLinks: [
            { href: sourceGrowth.href || '/ti/sources', label: 'Collection' },
            { href: sourceGrowth.source || '/api/ti/scraper/control', label: 'Source status' },
            { href: '/findings', label: 'DWM console' },
        ],
        workflowPath: path,
        missingDependency: sourceWorkerReady ? undefined : visibleChecks(sourceWorkerBlockers) || sourceGrowth.unavailableReason || 'Operator-reachable source worker data is syncing.',
        actions: [{
            id: 'open_source_worker_readiness',
            label: 'Open collection',
            method: 'GET',
            href: sourceGrowth.href || '/ti/sources',
        }, {
            id: 'inspect_source_worker_proof',
            label: 'Inspect source status',
            method: 'GET',
            href: sourceGrowth.source || '/api/ti/scraper/control',
        }],
    })
}
