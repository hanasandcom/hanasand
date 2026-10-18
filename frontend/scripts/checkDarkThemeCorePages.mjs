import { assertDarkThemeSurface } from './darkThemeSurfaceAssertions.mjs'

export function checkDarkThemeCorePages(sources, violations) {
    const { cookieSettings, darkwebIndex, publicHeader, statusClient, subscriptionPage, tiActivityPage } = sources
    assertDarkThemeSurface(cookieSettings, [
            'bg-ui-canvas',
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
        ], 'cookie-settings page should use shared palette class ',
        /\b(?:bg|text|border)-\[#/g,
        'cookie-settings page should not use one-off hex Tailwind colors after palette migration', violations,
    )

    assertDarkThemeSurface(darkwebIndex, [
            'bg-ui-canvas',
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
        ], 'TI darkweb index page should use shared palette class ',
        /\b(?:bg|text|border)-\[#/g,
        'TI darkweb index page should not use one-off hex Tailwind colors after palette migration', violations,
    )

    assertDarkThemeSurface(publicHeader, [
            'bg-ui-panel',
            'bg-ui-raised',
            'bg-ui-text',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-canvas',
        ], 'public header should use shared palette class ',
        /\b(?:bg|text|border)-\[#|\b(?:bg|text|border)-(?:white|black)\//g,
        'public header should not use one-off hex or white/black opacity Tailwind colors after palette migration', violations,
    )

    assertDarkThemeSurface(statusClient, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
            'text-ui-warning',
        ], 'public status page should use shared palette class ',
        /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g,
        'public status page should not use one-off color Tailwind utilities after palette migration', violations,
    )

    assertDarkThemeSurface(subscriptionPage, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
        ], 'subscription dashboard page should use shared palette class ',
        /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g,
        'subscription dashboard page should not use one-off color Tailwind utilities after palette migration', violations,
    )

    assertDarkThemeSurface(tiActivityPage, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
            'text-ui-warning',
        ], 'TI activity page should use shared palette class ',
        /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g,
        'TI activity page should not use one-off color Tailwind utilities after palette migration', violations,
    )

    // The legacy TI audit route redirects to the active management audit route;
    // it has no rendered surface to check here.
}
