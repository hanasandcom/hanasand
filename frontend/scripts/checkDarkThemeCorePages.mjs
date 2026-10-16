

export function checkDarkThemeCorePages(sources, violations) {
    const { cookieSettings, darkwebIndex, publicHeader, statusClient, subscriptionPage, tiActivityPage } = sources
    for (const required of [
        'bg-ui-canvas',
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-primary',
        'text-ui-success',
    ]) {
        if (!cookieSettings.includes(required)) {
            violations.push(`cookie-settings page should use shared palette class ${required}`)
        }
    }

    const bannedCookiePageColor = /\b(?:bg|text|border)-\[#/g
    if (bannedCookiePageColor.test(cookieSettings)) {
        violations.push('cookie-settings page should not use one-off hex Tailwind colors after palette migration')
    }

    for (const required of [
        'bg-ui-canvas',
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-primary',
    ]) {
        if (!darkwebIndex.includes(required)) {
            violations.push(`TI darkweb index page should use shared palette class ${required}`)
        }
    }

    const bannedDarkwebIndexColor = /\b(?:bg|text|border)-\[#/g
    if (bannedDarkwebIndexColor.test(darkwebIndex)) {
        violations.push('TI darkweb index page should not use one-off hex Tailwind colors after palette migration')
    }

    for (const required of [
        'bg-ui-panel',
        'bg-ui-raised',
        'bg-ui-text',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-primary',
        'text-ui-canvas',
    ]) {
        if (!publicHeader.includes(required)) {
            violations.push(`public header should use shared palette class ${required}`)
        }
    }

    const bannedPublicHeaderColor = /\b(?:bg|text|border)-\[#|\b(?:bg|text|border)-(?:white|black)\//g
    if (bannedPublicHeaderColor.test(publicHeader)) {
        violations.push('public header should not use one-off hex or white/black opacity Tailwind colors after palette migration')
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
        if (!statusClient.includes(required)) {
            violations.push(`public status page should use shared palette class ${required}`)
        }
    }

    const bannedStatusClientColor = /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g
    if (bannedStatusClientColor.test(statusClient)) {
        violations.push('public status page should not use one-off color Tailwind utilities after palette migration')
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
        if (!subscriptionPage.includes(required)) {
            violations.push(`subscription dashboard page should use shared palette class ${required}`)
        }
    }

    const bannedSubscriptionPageColor = /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g
    if (bannedSubscriptionPageColor.test(subscriptionPage)) {
        violations.push('subscription dashboard page should not use one-off color Tailwind utilities after palette migration')
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
        if (!tiActivityPage.includes(required)) {
            violations.push(`TI activity page should use shared palette class ${required}`)
        }
    }

    const bannedTiActivityPageColor = /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g
    if (bannedTiActivityPageColor.test(tiActivityPage)) {
        violations.push('TI activity page should not use one-off color Tailwind utilities after palette migration')
    }

    // The legacy TI audit route redirects to the active management audit route;
    // it has no rendered surface to check here.
}
