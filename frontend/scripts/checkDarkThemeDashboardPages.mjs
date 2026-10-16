

export function checkDarkThemeDashboardPages(sources, violations) {
    const { errorNotice, notesPage, dbBackupPage, trafficClient, logsClient, loadTestingClient } = sources
    for (const required of [
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-danger',
        'border-ui-primary',
        'border-ui-success',
        'text-ui-primary',
        'text-ui-success',
        'text-ui-text',
    ]) {
        if (!errorNotice.includes(required)) {
            violations.push(`shared error notice should use shared palette class ${required}`)
        }
    }

    const bannedErrorNoticeColor = /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g
    if (bannedErrorNoticeColor.test(errorNotice)) {
        violations.push('shared error notice should not use one-off color Tailwind utilities after palette migration')
    }

    for (const required of [
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-primary',
    ]) {
        if (!notesPage.includes(required)) {
            violations.push(`notes dashboard page should use shared palette class ${required}`)
        }
    }

    const bannedNotesPageColor = /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g
    if (bannedNotesPageColor.test(notesPage)) {
        violations.push('notes dashboard page should not use one-off color Tailwind utilities after palette migration')
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
        if (!dbBackupPage.includes(required)) {
            violations.push(`database backup page should use shared palette class ${required}`)
        }
    }

    const bannedDbBackupPageColor = /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g
    if (bannedDbBackupPageColor.test(dbBackupPage)) {
        violations.push('database backup page should not use one-off color Tailwind utilities after palette migration')
    }

    for (const required of [
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-primary',
    ]) {
        if (!trafficClient.includes(required)) {
            violations.push(`traffic dashboard client should use shared palette class ${required}`)
        }
    }

    const bannedTrafficClientColor = /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g
    if (bannedTrafficClientColor.test(trafficClient)) {
        violations.push('traffic dashboard client should not use one-off color Tailwind utilities after palette migration')
    }

    for (const required of [
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-primary',
        'text-ui-warning',
    ]) {
        if (!logsClient.includes(required)) {
            violations.push(`logs dashboard client should use shared palette class ${required}`)
        }
    }

    const bannedLogsClientColor = /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g
    if (bannedLogsClientColor.test(logsClient)) {
        violations.push('logs dashboard client should not use one-off color Tailwind utilities after palette migration')
    }

    for (const required of [
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-primary',
        'text-ui-warning',
    ]) {
        if (!loadTestingClient.includes(required)) {
            violations.push(`load testing dashboard client should use shared palette class ${required}`)
        }
    }

    const bannedLoadTestingClientColor = /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g
    if (bannedLoadTestingClientColor.test(loadTestingClient)) {
        violations.push('load testing dashboard client should not use one-off color Tailwind utilities after palette migration')
    }
}
