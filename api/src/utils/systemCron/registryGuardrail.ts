import { apiBackgroundJobDefinitions } from './apiJobDefinitions/index.ts'
import { managedCronDefinitions } from './managedDefinitions.ts'

export function scheduledJobRegistryGuardrailEntries() {
    return [
        ...managedCronDefinitions.map(job => ({ id: job.id, source: 'api/src/utils/systemCron.ts' })),
        ...apiBackgroundJobDefinitions.map(job => ({ id: job.id, source: job.source })),
        { id: 'deployment-compose-schedules', source: 'docker-compose.yml' },
        { id: 'ti-public-canary-collection', source: 'scraper/src/ops/canaryCollection.ts' },
        { id: 'ti-restricted-metadata-collection', source: 'scraper/src/ops/restrictedMetadataCollection.ts' },
        { id: 'ti-exposure-queue-collection', source: 'scraper/src/api/exposureQueueRoutes.ts' },
        { id: 'ti-exposure-parser', source: 'scraper/src/api/exposureQueueRoutes.ts' },
        { id: 'ti-dwm-alert-generation', source: 'scraper/src/api/dwmWorkflowRoutes.ts' },
        { id: 'ti-source-pack-worker', source: 'scraper/src/api/dwmSourceRequestRoute.ts' },
        { id: 'ti-frontier-queue', source: 'scraper/src/frontier/frontier.ts' },
        { id: 'ti-automatic-review', source: 'scraper/src/api/automaticReviewRoutes.ts' },
        { id: 'ti-automatic-evaluation', source: 'scraper/src/api/evaluationBenchmarkRoutes.ts' },
    ]
}
