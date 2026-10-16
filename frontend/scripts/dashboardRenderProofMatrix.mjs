export function buildRenderProofMatrix(readinessRows) {
    const renderedRouteIds = [
        'dashboard', 'public_ti', 'public_ti_apt29', 'ti_workbench', 'cron_jobs', 'vulnerabilities', 'readiness',
        'traffic', 'system', 'database', 'logs', 'automations', 'subscription', 'notes', 'ti_activity',
        'ti_audit', 'ti_enrichment', 'ti_sources', 'ti_runs',
    ]
    const renderedScreenshots = renderedRouteIds.flatMap(routeId =>
        ['dark', 'light'].flatMap(colorScheme =>
            ['desktop', 'mobile'].map(viewport => `/tmp/hanasand-${routeId}-${viewport}-${colorScheme}.png`)
        )
    )
    return {
        viewports: [
            { name: 'desktop', width: 1440, height: 1000 },
            { name: 'mobile', width: 390, height: 844 },
        ],
        colorSchemes: ['dark', 'light'],
        screenshots: renderedScreenshots,
        command: 'node scripts/check-dashboard-render-dom.mjs --base-url=http://127.0.0.1:3010 --out-dir=/tmp',
        artifact: '/tmp/hanasand-dashboard-render-proof.json',
        schema: 'hanasand.dashboard.render-proof.v1',
        rows: readinessRows,
        failureConditions: [
            'missing readiness row selector',
            'empty owner lane or operator action',
            'missing deep-link target',
            'missing proof timestamp, stale threshold, probe hint, dashboard row id, or backend proof contract version',
            'missing readiness priority or scorecard link',
            'missing readiness detail owner, action, proof, blocker, or deep link',
            'ready row with nonzero blocker count',
            'non-ready row without unavailable reason',
            'visible prompt/coordinator wording',
            'computed text/background contrast below WCAG AA on visible controls, chips, tags, or status rows',
            'white translucent dark-mode borders',
            'missing screenshot or acceptance JSON artifact',
            'overlapping readiness rows or source operation actions',
            'nested readiness links counted as overlaps',
            'action/status text clipped or stacked vertically',
        ],
    }
}
