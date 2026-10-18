import { assertDarkThemeSurface } from './darkThemeSurfaceAssertions.mjs'

export function checkDarkThemeDashboardPages(sources, violations) {
    const { errorNotice, notesPage, dbBackupPage, trafficClient, logsClient, loadTestingClient } = sources
    assertDarkThemeSurface(errorNotice, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-danger',
            'border-ui-primary',
            'border-ui-success',
            'text-ui-primary',
            'text-ui-success',
            'text-ui-text',
        ], 'shared error notice should use shared palette class ',
        /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g,
        'shared error notice should not use one-off color Tailwind utilities after palette migration', violations,
    )

    assertDarkThemeSurface(notesPage, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
        ], 'notes dashboard page should use shared palette class ',
        /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g,
        'notes dashboard page should not use one-off color Tailwind utilities after palette migration', violations,
    )

    assertDarkThemeSurface(dbBackupPage, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
            'text-ui-warning',
            'text-ui-danger',
        ], 'database backup page should use shared palette class ',
        /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g,
        'database backup page should not use one-off color Tailwind utilities after palette migration', violations,
    )

    assertDarkThemeSurface(trafficClient, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
        ], 'traffic dashboard client should use shared palette class ',
        /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g,
        'traffic dashboard client should not use one-off color Tailwind utilities after palette migration', violations,
    )

    assertDarkThemeSurface(logsClient, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-warning',
        ], 'logs dashboard client should use shared palette class ',
        /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g,
        'logs dashboard client should not use one-off color Tailwind utilities after palette migration', violations,
    )

    assertDarkThemeSurface(loadTestingClient, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-warning',
        ], 'load testing dashboard client should use shared palette class ',
        /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g,
        'load testing dashboard client should not use one-off color Tailwind utilities after palette migration', violations,
    )
}
