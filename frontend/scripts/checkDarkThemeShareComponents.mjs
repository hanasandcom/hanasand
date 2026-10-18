import { assertDarkThemeSurface } from './darkThemeSurfaceAssertions.mjs'

export function checkDarkThemeShareComponents(sources, violations) {
    const { testContent, gitPlugin, workspaceSearchPanel, metadataPanel, referencePanel, terminalPanel, homepageActivityFeed, dwmWorkflowActions, recentScans } = sources
    assertDarkThemeSurface({
        source: testContent,
        requiredClasses: [
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
        ],
        missingClassPrefix: 'test results content should use shared palette token ',
        bannedColorPattern: /#[0-9a-fA-F]{3,6}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue)\//g,
        bannedColorMessage: 'test results content should not use one-off Tailwind or chart hex colors after palette migration',
    }, violations)

    assertDarkThemeSurface({
        source: gitPlugin,
        requiredClasses: [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
            'text-ui-warning',
        ],
        missingClassPrefix: 'share git plugin should use shared palette class ',
        bannedColorPattern: /#[0-9a-fA-F]{3,6}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue)\b|\b(?:bg|text|border|ring|outline)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue)\//g,
        bannedColorMessage: 'share git plugin should not use one-off Git/share color utilities after palette migration',
    }, violations)

    assertDarkThemeSurface({
        source: workspaceSearchPanel,
        requiredClasses: [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
        ],
        missingClassPrefix: 'workspace search panel should use shared palette class ',
        bannedColorPattern: /#[0-9a-fA-F]{3,6}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue)\b|\b(?:bg|text|border|ring|outline)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue)\//g,
        bannedColorMessage: 'workspace search panel should not use one-off share color utilities after palette migration',
    }, violations)

    assertDarkThemeSurface({
        source: metadataPanel,
        requiredClasses: [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
        ],
        missingClassPrefix: 'share metadata panel should use shared palette class ',
        bannedColorPattern: /#[0-9a-fA-F]{3,6}|\b(?:bg|text|border|ring|outline|stroke)-\[#|\b(?:bg|text|border|ring|outline|stroke)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|rgb|light|extralight|background)\b|\b(?:bg|text|border|ring|outline|stroke)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|rgb|light|extralight|background)\//g,
        bannedColorMessage: 'share metadata panel should not use one-off share color utilities after palette migration',
    }, violations)

    assertDarkThemeSurface({
        source: referencePanel,
        requiredClasses: [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
        ],
        missingClassPrefix: 'share reference panel should use shared palette class ',
        bannedColorPattern: /#[0-9a-fA-F]{3,6}|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline|shadow)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|background)\b|\b(?:bg|text|border|ring|outline|shadow)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|background)\//g,
        bannedColorMessage: 'share reference panel should not use one-off share color utilities after palette migration',
    }, violations)

    assertDarkThemeSurface({
        source: terminalPanel,
        requiredClasses: [
            'bg-ui-canvas',
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
            'text-ui-warning',
        ],
        missingClassPrefix: 'share terminal panel should use shared palette class ',
        bannedColorPattern: /#[0-9a-fA-F]{3,6}|rgba\(|\b(?:bg|text|border|ring|outline|shadow|stroke)-\[#|\b(?:bg|text|border|ring|outline|shadow|stroke)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|gray|light|extralight|background)\b|\b(?:bg|text|border|ring|outline|shadow|stroke)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|gray|light|extralight|background)\//g,
        bannedColorMessage: 'share terminal panel should not use one-off share color utilities after palette migration',
    }, violations)

    assertDarkThemeSurface({
        source: homepageActivityFeed,
        requiredClasses: [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
        ],
        missingClassPrefix: 'home latest activity panel should use shared palette class ',
        bannedColorPattern: /#[0-9a-fA-F]{3,8}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue)\//g,
        bannedColorMessage: 'home latest activity panel should not use one-off public homepage color utilities after palette migration',
    }, violations)

    assertDarkThemeSurface({
        source: dwmWorkflowActions,
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
        missingClassPrefix: 'DWM workflow actions should use shared palette class ',
        bannedColorPattern: /#[0-9a-fA-F]{3,8}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\//g,
        bannedColorMessage: 'DWM workflow actions should not use one-off dark dashboard color utilities after palette migration',
    }, violations)

    assertDarkThemeSurface({
        source: recentScans,
        requiredClasses: [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
            'text-ui-warning',
        ],
        missingClassPrefix: 'recent scans component should use shared palette class ',
        bannedColorPattern: /#[0-9a-fA-F]{3,8}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\//g,
        bannedColorMessage: 'recent scans component should not use one-off test dashboard color utilities after palette migration',
    }, violations)
}
