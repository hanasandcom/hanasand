import { assertDarkThemeSurface } from './darkThemeSurfaceAssertions.mjs'

export function checkDarkThemeShareComponents(sources, violations) {
    const { testContent, gitPlugin, workspaceSearchPanel, metadataPanel, referencePanel, terminalPanel, homepageActivityFeed, dwmWorkflowActions, recentScans } = sources
    assertDarkThemeSurface(testContent, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
            'text-ui-warning',
            'var(--ui-border)',
            'var(--ui-muted)',
            'var(--ui-primary)',
            'var(--ui-success)',
            'var(--ui-warning)',
        ], 'test results content should use shared palette token ',
        /#[0-9a-fA-F]{3,6}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue)\//g,
        'test results content should not use one-off Tailwind or chart hex colors after palette migration', violations,
    )

    assertDarkThemeSurface(gitPlugin, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
            'text-ui-warning',
        ], 'share git plugin should use shared palette class ',
        /#[0-9a-fA-F]{3,6}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue)\b|\b(?:bg|text|border|ring|outline)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue)\//g,
        'share git plugin should not use one-off Git/share color utilities after palette migration', violations,
    )

    assertDarkThemeSurface(workspaceSearchPanel, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
        ], 'workspace search panel should use shared palette class ',
        /#[0-9a-fA-F]{3,6}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue)\b|\b(?:bg|text|border|ring|outline)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue)\//g,
        'workspace search panel should not use one-off share color utilities after palette migration', violations,
    )

    assertDarkThemeSurface(metadataPanel, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
        ], 'share metadata panel should use shared palette class ',
        /#[0-9a-fA-F]{3,6}|\b(?:bg|text|border|ring|outline|stroke)-\[#|\b(?:bg|text|border|ring|outline|stroke)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|rgb|light|extralight|background)\b|\b(?:bg|text|border|ring|outline|stroke)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|rgb|light|extralight|background)\//g,
        'share metadata panel should not use one-off share color utilities after palette migration', violations,
    )

    assertDarkThemeSurface(referencePanel, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
        ], 'share reference panel should use shared palette class ',
        /#[0-9a-fA-F]{3,6}|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline|shadow)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|background)\b|\b(?:bg|text|border|ring|outline|shadow)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|background)\//g,
        'share reference panel should not use one-off share color utilities after palette migration', violations,
    )

    assertDarkThemeSurface(terminalPanel, [
            'bg-ui-canvas',
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
            'text-ui-warning',
        ], 'share terminal panel should use shared palette class ',
        /#[0-9a-fA-F]{3,6}|rgba\(|\b(?:bg|text|border|ring|outline|shadow|stroke)-\[#|\b(?:bg|text|border|ring|outline|shadow|stroke)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|gray|light|extralight|background)\b|\b(?:bg|text|border|ring|outline|shadow|stroke)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|gray|light|extralight|background)\//g,
        'share terminal panel should not use one-off share color utilities after palette migration', violations,
    )

    assertDarkThemeSurface(homepageActivityFeed, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
        ], 'home latest activity panel should use shared palette class ',
        /#[0-9a-fA-F]{3,8}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue)\//g,
        'home latest activity panel should not use one-off public homepage color utilities after palette migration', violations,
    )

    assertDarkThemeSurface(dwmWorkflowActions, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
            'text-ui-warning',
            'text-ui-danger',
        ], 'DWM workflow actions should use shared palette class ',
        /#[0-9a-fA-F]{3,8}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\//g,
        'DWM workflow actions should not use one-off dark dashboard color utilities after palette migration', violations,
    )

    assertDarkThemeSurface(recentScans, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
            'text-ui-warning',
        ], 'recent scans component should use shared palette class ',
        /#[0-9a-fA-F]{3,8}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\//g,
        'recent scans component should not use one-off test dashboard color utilities after palette migration', violations,
    )
}
