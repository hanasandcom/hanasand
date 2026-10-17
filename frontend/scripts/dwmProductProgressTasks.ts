import { bun, type TestTask } from './testTask'

export const dwmProductProgressTasks: TestTask[] = [
    { id: 'dwm-case-detail-source', title: 'DWM case detail source contract', command: [bun, 'test', 'tests/dwm-case-detail-source.test.ts'] },
    { id: 'dwm-cases-overview', title: 'DWM cases overview mapping', command: [bun, 'test', 'tests/dwm-cases-overview.test.ts'] },
    { id: 'dwm-delivery-truthfulness', title: 'DWM delivery status truthfulness', command: [bun, 'test', 'tests/dwm-delivery-truthfulness.test.ts'] },
    { id: 'dwm-report-delivery-route', title: 'DWM report delivery validation', command: [bun, 'test', 'tests/dwm-report-delivery-route.test.ts'] },
    { id: 'dwm-scraper-api-base', title: 'DWM scraper API base selection', command: [bun, 'test', 'tests/dwm-scraper-api-base.test.ts'] },
    { id: 'dwm-webhook-receiver-route', title: 'DWM webhook receiver acknowledgement and failure handling', command: [bun, 'test', 'tests/dwm-webhook-receiver-route.test.ts'] },
    { id: 'dwm-workflow-rebuild', title: 'DWM workflow rebuild persistence outcomes', command: [bun, 'test', 'tests/dwm-workflow-rebuild.test.ts'] },
    { id: 'product-progress-case-workflows', title: 'Product progress case workflow actions', command: [bun, 'test', 'tests/product-progress-case-workflows.test.ts'] },
    { id: 'product-progress-delivery', title: 'Product progress delivery truth', command: [bun, 'test', 'tests/product-progress-delivery.test.ts'] },
    { id: 'product-progress-organization-context', title: 'Product progress organization context', command: [bun, 'test', 'tests/product-progress-organization-context.test.ts'] },
    { id: 'product-progress-organization-readiness', title: 'Product progress organization readiness actions', command: [bun, 'test', 'tests/product-progress-organization-readiness.test.ts'] },
    { id: 'product-progress-route-response', title: 'Product progress route response assembly', command: [bun, 'test', 'tests/product-progress-route-response.test.ts'] },
    { id: 'product-progress-readiness-contract', title: 'Product progress readiness contract', command: [bun, 'test', 'tests/product-progress-readiness-contract.test.ts'] },
    { id: 'product-progress-readiness-rows', title: 'Product progress readiness rows', command: [bun, 'test', 'tests/product-progress-readiness-rows.test.ts'] },
    { id: 'product-progress-readiness-degraded', title: 'Product progress degraded readiness proofs', command: [bun, 'test', 'tests/product-progress-readiness-degraded.test.ts'] },
    { id: 'product-progress-source-actions', title: 'Product progress source actions', command: [bun, 'test', 'tests/product-progress-source-actions.test.ts'] },
    { id: 'workflow-action-lifecycle', title: 'Findings workflow action lifecycle', command: [bun, 'test', 'tests/workflow-action-lifecycle.test.ts'] },
    { id: 'product-progress-truthfulness', title: 'Product progress readiness truthfulness', command: [bun, 'test', 'tests/product-progress-truthfulness.test.mjs'] },
]
