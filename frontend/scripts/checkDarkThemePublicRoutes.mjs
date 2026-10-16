
import { joinPwnedSources } from './darkThemeSources.mjs'

export function checkDarkThemePublicRoutes(sources, violations) {
    const { loginPageClient, publicFooter, contactPage, sharePublicClient, shareRenderSite, uploadPreview } = sources
    const pwnedRouteCluster = joinPwnedSources(sources)
    for (const requiredPrivacyToken of [
        'checkedPrefix',
        'const prefix = hash.slice(0, 5)',
        'Only the first five characters leave this page.',
    ]) {
        if (!pwnedRouteCluster.includes(requiredPrivacyToken)) {
            violations.push(`pwned password check should disclose hash-prefix privacy behavior: ${requiredPrivacyToken}`)
        }
    }

    for (const required of [
        'bg-ui-canvas',
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-primary',
        'text-ui-warning',
    ]) {
        if (!loginPageClient.includes(required)) {
            violations.push(`login page should use shared palette class ${required}`)
        }
    }

    const bannedLoginPageClientColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\//g
    if (bannedLoginPageClientColor.test(loginPageClient)) {
        violations.push('login page should not use one-off public page color utilities after palette migration')
    }


    for (const required of [
        'bg-ui-canvas',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-danger',
    ]) {
        if (!publicFooter.includes(required)) {
            violations.push(`public footer should use shared palette class ${required}`)
        }
    }

    const bannedPublicFooterColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\//g
    if (bannedPublicFooterColor.test(publicFooter)) {
        violations.push('public footer should not use one-off public page color utilities after palette migration')
    }

    for (const required of [
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-primary',
    ]) {
        if (!uploadPreview.includes(required)) {
            violations.push(`upload preview should use shared palette class ${required}`)
        }
    }

    const bannedUploadPreviewColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\//g
    if (bannedUploadPreviewColor.test(uploadPreview)) {
        violations.push('upload preview should not use one-off upload form color utilities after palette migration')
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
    ]) {
        if (!contactPage.includes(required)) {
            violations.push(`contact page should use shared palette class ${required}`)
        }
    }

    const bannedContactPageColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\//g
    if (bannedContactPageColor.test(contactPage)) {
        violations.push('contact page should not use one-off public page color utilities after palette migration')
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
        'text-ui-canvas',
    ]) {
        if (!sharePublicClient.includes(required)) {
            violations.push(`public share client should use shared palette class ${required}`)
        }
    }

    const bannedSharePublicClientColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\//g
    if (bannedSharePublicClientColor.test(sharePublicClient)) {
        violations.push('public share client should not use one-off share chrome color utilities after palette migration')
    }

    for (const required of [
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'bg-ui-border',
        'bg-ui-primary',
    ]) {
        if (!shareRenderSite.includes(required)) {
            violations.push(`share renderer should use shared palette class ${required}`)
        }
    }

    const bannedShareRenderColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\//g
    if (bannedShareRenderColor.test(shareRenderSite)) {
        violations.push('share renderer should not use one-off color utilities after palette migration')
    }
}
