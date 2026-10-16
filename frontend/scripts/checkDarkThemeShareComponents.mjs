

export function checkDarkThemeShareComponents(sources, violations) {
    const { testContent, gitPlugin, workspaceSearchPanel, metadataPanel, referencePanel, terminalPanel, homepageActivityFeed, dwmWorkflowActions, recentScans } = sources
    for (const required of [
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
    ]) {
        if (!testContent.includes(required)) {
            violations.push(`test results content should use shared palette token ${required}`)
        }
    }

    const bannedTestContentColor = /#[0-9a-fA-F]{3,6}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue)\//g
    if (bannedTestContentColor.test(testContent)) {
        violations.push('test results content should not use one-off Tailwind or chart hex colors after palette migration')
    }

    for (const required of [
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-primary',
        'text-ui-success',
        'text-ui-warning',
    ]) {
        if (!gitPlugin.includes(required)) {
            violations.push(`share git plugin should use shared palette class ${required}`)
        }
    }

    const bannedGitPluginColor = /#[0-9a-fA-F]{3,6}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue)\b|\b(?:bg|text|border|ring|outline)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue)\//g
    if (bannedGitPluginColor.test(gitPlugin)) {
        violations.push('share git plugin should not use one-off Git/share color utilities after palette migration')
    }

    for (const required of [
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-primary',
    ]) {
        if (!workspaceSearchPanel.includes(required)) {
            violations.push(`workspace search panel should use shared palette class ${required}`)
        }
    }

    const bannedWorkspaceSearchPanelColor = /#[0-9a-fA-F]{3,6}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue)\b|\b(?:bg|text|border|ring|outline)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue)\//g
    if (bannedWorkspaceSearchPanelColor.test(workspaceSearchPanel)) {
        violations.push('workspace search panel should not use one-off share color utilities after palette migration')
    }

    for (const required of [
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-primary',
        'text-ui-success',
    ]) {
        if (!metadataPanel.includes(required)) {
            violations.push(`share metadata panel should use shared palette class ${required}`)
        }
    }

    const bannedMetadataPanelColor = /#[0-9a-fA-F]{3,6}|\b(?:bg|text|border|ring|outline|stroke)-\[#|\b(?:bg|text|border|ring|outline|stroke)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|rgb|light|extralight|background)\b|\b(?:bg|text|border|ring|outline|stroke)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|rgb|light|extralight|background)\//g
    if (bannedMetadataPanelColor.test(metadataPanel)) {
        violations.push('share metadata panel should not use one-off share color utilities after palette migration')
    }

    for (const required of [
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-primary',
    ]) {
        if (!referencePanel.includes(required)) {
            violations.push(`share reference panel should use shared palette class ${required}`)
        }
    }

    const bannedReferencePanelColor = /#[0-9a-fA-F]{3,6}|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline|shadow)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|background)\b|\b(?:bg|text|border|ring|outline|shadow)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|background)\//g
    if (bannedReferencePanelColor.test(referencePanel)) {
        violations.push('share reference panel should not use one-off share color utilities after palette migration')
    }

    for (const required of [
        'bg-ui-canvas',
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-primary',
        'text-ui-success',
        'text-ui-warning',
    ]) {
        if (!terminalPanel.includes(required)) {
            violations.push(`share terminal panel should use shared palette class ${required}`)
        }
    }

    const bannedTerminalPanelColor = /#[0-9a-fA-F]{3,6}|rgba\(|\b(?:bg|text|border|ring|outline|shadow|stroke)-\[#|\b(?:bg|text|border|ring|outline|shadow|stroke)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|gray|light|extralight|background)\b|\b(?:bg|text|border|ring|outline|shadow|stroke)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|gray|light|extralight|background)\//g
    if (bannedTerminalPanelColor.test(terminalPanel)) {
        violations.push('share terminal panel should not use one-off share color utilities after palette migration')
    }

    for (const required of [
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-primary',
    ]) {
        if (!homepageActivityFeed.includes(required)) {
            violations.push(`home latest activity panel should use shared palette class ${required}`)
        }
    }

    const bannedHomepageActivityColor = /#[0-9a-fA-F]{3,8}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue)\//g
    if (bannedHomepageActivityColor.test(homepageActivityFeed)) {
        violations.push('home latest activity panel should not use one-off public homepage color utilities after palette migration')
    }

    for (const required of [
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-primary',
        'text-ui-success',
        'text-ui-warning',
        'text-ui-danger',
    ]) {
        if (!dwmWorkflowActions.includes(required)) {
            violations.push(`DWM workflow actions should use shared palette class ${required}`)
        }
    }

    const bannedDwmWorkflowActionsColor = /#[0-9a-fA-F]{3,8}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\//g
    if (bannedDwmWorkflowActionsColor.test(dwmWorkflowActions)) {
        violations.push('DWM workflow actions should not use one-off dark dashboard color utilities after palette migration')
    }

    for (const required of [
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-primary',
        'text-ui-success',
        'text-ui-warning',
    ]) {
        if (!recentScans.includes(required)) {
            violations.push(`recent scans component should use shared palette class ${required}`)
        }
    }

    const bannedRecentScansColor = /#[0-9a-fA-F]{3,8}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\//g
    if (bannedRecentScansColor.test(recentScans)) {
        violations.push('recent scans component should not use one-off test dashboard color utilities after palette migration')
    }
}
