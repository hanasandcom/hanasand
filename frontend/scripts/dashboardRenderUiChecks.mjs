import assert from 'node:assert/strict'
import { readDashboardRenderSource } from './dashboardRenderSource.mjs'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

export function runUiChecks(readinessRows) {
    const workbench = [
        read('../src/app/dashboard/ti/workbench/workbenchClient.tsx'),
        read('../src/app/dashboard/ti/workbench/modules/readinessPanel.tsx'),
        read('../src/app/dashboard/ti/workbench/modules/readinessDetail.tsx'),
    ].join('\n')
    const model = [
        read('../src/app/dashboard/operatorConsoleModel.ts'),
        read('../src/app/dashboard/productReadinessCoreRows.ts'),
        read('../src/app/dashboard/productReadinessDeliveryRows.ts'),
        read('../src/app/dashboard/productReadinessSourceRows.ts'),
    ].join('\n')
    const page = read('../src/app/dashboard/page.tsx')
    const renderDom = readDashboardRenderSource()
    const progress = read('../src/utils/productProgress/readiness.ts')

    const repoRoot = fileURLToPath(new URL('..', import.meta.url))
    for (const check of [
        ['scripts/check-product-progress-webhook-proof.ts'],
        ['scripts/check-product-progress-alert-generation.ts'],
        ['scripts/check-product-progress-public-ti.ts'],
        ['test', 'tests/product-progress-readiness-degraded.test.ts'],
    ]) execFileSync('bun', check, { cwd: repoRoot, stdio: 'ignore' })

    for (const attr of [
        'data-readiness-row-id', 'data-readiness-state', 'data-readiness-blocker-count', 'data-readiness-deep-link-target',
        'data-readiness-checked-at', 'data-readiness-unavailable-reason', 'data-readiness-stale-after-seconds',
        'data-readiness-expected-dashboard-row-id', 'data-readiness-integration-probe-hint', 'data-readiness-backend-contract-version',
        'data-readiness-owner-lane', 'data-readiness-operator-action', 'data-readiness-priority', 'data-readiness-detail',
        'data-readiness-detail-state', 'data-readiness-detail-owner', 'data-readiness-detail-action', 'data-readiness-detail-contract',
        'data-readiness-detail-blocker', 'data-readiness-detail-href', 'data-readiness-source-reference', 'data-readiness-detail-source-reference',
    ]) assert.ok(workbench.includes(attr), `Missing DOM proof attribute ${attr}`)

    for (const requiredClass of [
        'dark:border-ui-border', 'dark:hover:border-ui-border', 'wrap-break-word text-xs font-semibold',
        'wrap-break-word text-[11px]', 'wrap-break-word text-[10px]', 'shrink-0', 'min-w-0',
        'flex flex-wrap items-start justify-between gap-3', 'min-w-36', 'min-w-44',
    ]) assert.ok(workbench.includes(requiredClass), `Missing render guard class ${requiredClass}`)

    for (const source of [workbench, model, page]) {
        const lowered = source.toLowerCase()
        for (const copy of ['control room', 'prompt-shaped', 'acceptance criteria', 'coordinator', 'delegation', 'you are tasked']) assert.equal(lowered.includes(copy), false, `Dashboard source includes banned copy: ${copy}`)
        for (const token of ['border-white/', 'bg-white/10', 'bg-white/15']) assert.equal(source.includes(token), false, `Dashboard source includes high-contrast dark class: ${token}`)
    }
    for (const copy of ['APT29', 'LockBit', 'dashboard slop', 'how this feeds', '/ti/<query>', 'dashboard handoff', 'backed handoff']) {
        assert.equal(page.includes(copy) || model.includes(copy), false, `Dashboard visible source includes prompt/example copy: ${copy}`)
    }
    for (const field of ['ownerLane', 'unavailableReason', 'staleAfterSeconds', 'proofTimestamp', 'expectedDashboardRowId', 'integrationProbeHint', 'backendProofContractVersion']) {
        assert.ok(progress.includes(field), `Product-progress dependency proof field missing: ${field}`)
    }

    for (const token of [
        'hanasand.dashboard.render-proof.v1', '/ti/apt29', '/ti/workbench', '/automation/cron', '/vulnerabilities', '/traffic',
        '/system', '/db', '/logs', '/automation', '/subscription', '/notes', '/ti/activity', '/ti/audit', '/ti/profiles',
        '/ti/sources', '/ti/runs', 'screenshotPath', 'selectorCounts', 'overlapCount', 'bannedCopyList', 'colorSchemes',
        'contrastIssues', 'low contrast', 'deadEndCopyPatterns', 'visible dead-end state copy', 'narrowActionCount',
        'highContrastTokenHits', 'local-dashboard-render-proof', 'x-hanasand-render-proof-auth', 'name: \'theme\'',
        'document.documentElement.classList.toggle(\'dark\'', 'window.localStorage.setItem(\'theme\', scheme)', 'gotoWithRetry',
        'ERR_EMPTY_RESPONSE|ERR_CONNECTION_REFUSED|ECONNREFUSED', 'rendered login screen; dashboard auth fixture was not accepted',
        '--base-url=', '--page=', 'Unknown page ids', '[render-proof]', 'waitUntil: \'domcontentloaded\'', 'waitFor({ state: \'attached\'',
        '[role="listbox"][aria-label="Analyst case list"]', 'readiness detail missing',
    ]) assert.ok(renderDom.includes(token), `Rendered proof command missing ${token}`)

    for (const copy of ['control room', 'prompt-shaped', 'acceptance criteria', 'coordinator', 'delegation', 'you are tasked', 'worker 3', 'ti control room', 'how this feeds', '/ti/<query>', 'dashboard slop', 'dashboard handoff', 'backed handoff']) {
        assert.ok(renderDom.includes(copy), `Rendered proof command missing banned copy check: ${copy}`)
    }
    for (const stateCopy of ['blocked', 'needs action', 'action required', 'needs work', 'needs proof', 'will appear here after', 'ai parser output', 'source provenance', 'evidence-backed', 'source-backed']) {
        assert.ok(renderDom.includes(stateCopy), `Rendered proof command missing dead-end state copy check: ${stateCopy}`)
    }
    for (const warning of ['consolewarnings', 'same key', 'encountered two children']) {
        assert.ok(renderDom.toLowerCase().includes(warning), `Rendered proof command missing console warning guard: ${warning}`)
    }

    assert.ok(Object.keys(readinessRows).length > 0)
}
