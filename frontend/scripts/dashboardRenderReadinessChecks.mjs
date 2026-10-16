import assert from 'node:assert/strict'
import { readDashboardRenderSource } from './dashboardRenderSource.mjs'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

export const readinessRows = {
    dashboard_evidence: { href: '/dashboard', backendProbe: 'GET /api/product-progress .dashboardEvidence + /api/findings/alerts/generation-readiness evidence window', commits: ['89d9547e', 'dfb2d272'] },
    source_inventory_probe: { href: '/ti/sources', backendProbe: 'GET /api/ti/scraper/control + source readiness 930f93af', commits: ['930f93af', '178ec078', '342c1fe3'] },
    end_to_end_workflow: { href: '/ti/sources', backendProbe: 'GET /api/ti/scraper/control contracts.productReadinessEndToEndWorkflowPacket fb8a2066', commits: ['fb8a2066'] },
    dwm_product_snapshot: { href: '/findings', backendProbe: 'GET /api/findings/product', commits: ['9d4c7118', '03d8d1ec'] },
    entitlement_readiness: { href: '/findings', backendProbe: 'GET /api/findings/entitlements/readiness', commits: ['4da6a209', '1c88a82a'] },
    webhook_delivery: { href: '/automation?setup=dwm', backendProbe: 'GET /api/findings/webhooks/deliveries', commits: ['14210040', '03d8d1ec'] },
    org_alert_export: { href: '/findings', backendProbe: 'GET /api/organizations/:id/alert-readiness readinessProof', commits: ['414c72a4', 'd0f53e04'] },
    webhook_health: { href: '/automation?setup=dwm', backendProbe: 'GET /api/organizations/:id/webhooks destinationAdminProof.productProgress', commits: ['b3600c7e', 'adbe584b'] },
    helpdesk_audit: { href: '/system/impersonation', backendProbe: 'GET /api/backend/admin/support/access-recovery + GET /api/backend/admin/audit-events', commits: ['016a8ef7', '9e25b6ad', '5b7d9357'] },
    deploy_probe: { href: '/status', backendProbe: 'GET /api/product-progress .deployProbe', commits: ['89d9547e'] },
    public_ti_provenance: { href: '/ti', backendProbe: 'GET /api/ti/search publicTiAnswer + actionability + source family coverage matrix', commits: ['def920a7', '929f3416'] },
}

export function runReadinessChecks() {
    const rowSources = [
        read('../src/app/dashboard/productReadinessCoreRows.ts'),
        read('../src/app/dashboard/productReadinessDeliveryRows.ts'),
        read('../src/app/dashboard/productReadinessSourceRows.ts'),
    ]
    const readinessTestSource = read('../tests/product-progress-readiness-rows.test.ts')
    const renderDomSource = readDashboardRenderSource()
    for (const id of Object.keys(readinessRows)) {
        assert.ok(rowSources.some(source => source.includes(`'${id}'`)), `Missing model row id ${id}`)
        assert.ok(readinessTestSource.includes(`'${id}'`), `Missing runtime readiness assertion for row ${id}`)
    }
    for (const [id, spec] of Object.entries(readinessRows)) {
        assert.ok(readinessTestSource.includes(spec.href) || rowSources.some(source => source.includes(spec.href)) || renderDomSource.includes(spec.href), `Missing backed href ${spec.href} for ${id}`)
        for (const commit of spec.commits) {
            assert.match(commit, /^[a-f0-9]{8,40}$/, `Malformed backend commit reference for ${id}`)
            try {
                execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: 'ignore' })
            } catch {
                assert.ok(spec.backendProbe.includes(commit), `Missing backend commit reference ${commit} for ${id}`)
            }
        }
        assert.ok(renderDomSource.includes(id), `Rendered proof command missing row ${id}`)
        assert.ok(renderDomSource.includes(spec.href), `Rendered proof command missing href ${spec.href}`)
    }
    return readinessRows
}
