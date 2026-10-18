import { assertDarkThemeSurface } from './darkThemeSurfaceAssertions.mjs'

export function checkDarkThemeDashboardPages(sources, violations) {
    const { errorNotice, notesPage, dbBackupPage, trafficClient, logsClient, loadTestingClient } = sources
    assertDarkThemeSurface({
        source: errorNotice,
        requiredClasses: [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-danger',
            'border-ui-primary',
            'border-ui-success',
            'text-ui-primary',
            'text-ui-success',
            'text-ui-text',
        ],
        missingClassPrefix: 'shared error notice should use shared palette class ',
        bannedColorPattern: /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g,
        bannedColorMessage: 'shared error notice should not use one-off color Tailwind utilities after palette migration',
    }, violations)

    assertDarkThemeSurface({
        source: notesPage,
        requiredClasses: [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
        ],
        missingClassPrefix: 'notes dashboard page should use shared palette class ',
        bannedColorPattern: /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g,
        bannedColorMessage: 'notes dashboard page should not use one-off color Tailwind utilities after palette migration',
    }, violations)

    assertDarkThemeSurface({
        source: dbBackupPage,
        requiredClasses: [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
            'text-ui-warning',
            'text-ui-danger',
        ],
        missingClassPrefix: 'database backup page should use shared palette class ',
        bannedColorPattern: /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g,
        bannedColorMessage: 'database backup page should not use one-off color Tailwind utilities after palette migration',
    }, violations)

    assertDarkThemeSurface({
        source: trafficClient,
        requiredClasses: [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
        ],
        missingClassPrefix: 'traffic dashboard client should use shared palette class ',
        bannedColorPattern: /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g,
        bannedColorMessage: 'traffic dashboard client should not use one-off color Tailwind utilities after palette migration',
    }, violations)

    assertDarkThemeSurface({
        source: logsClient,
        requiredClasses: [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-warning',
        ],
        missingClassPrefix: 'logs dashboard client should use shared palette class ',
        bannedColorPattern: /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g,
        bannedColorMessage: 'logs dashboard client should not use one-off color Tailwind utilities after palette migration',
    }, violations)

    assertDarkThemeSurface({
        source: loadTestingClient,
        requiredClasses: [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-warning',
        ],
        missingClassPrefix: 'load testing dashboard client should use shared palette class ',
        bannedColorPattern: /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g,
        bannedColorMessage: 'load testing dashboard client should not use one-off color Tailwind utilities after palette migration',
    }, violations)
}
