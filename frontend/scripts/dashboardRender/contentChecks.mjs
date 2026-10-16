export function inspectPageContent(snapshot, spec, { bannedCopy, deadEndCopyPatterns, highContrastDarkTokens }) {
    const reasons = []
    if (snapshot.pathname === '/login' || snapshot.bodyText.includes('login') && snapshot.bodyText.includes('password')) {
        reasons.push('rendered login screen; dashboard auth fixture was not accepted')
    }
    const bannedCopyList = bannedCopy.filter(value => !(spec.allowedBannedCopy || []).includes(value) && snapshot.bodyText.includes(value))
    for (const phrase of bannedCopyList) reasons.push(`visible banned copy: ${phrase}`)
    for (const { label, pattern, allowedNearby = [] } of deadEndCopyPatterns) {
        if (!new RegExp(pattern, 'i').test(snapshot.bodyText)) continue
        if (!allowedNearby.some(value => snapshot.bodyText.includes(value))) reasons.push(`visible dead-end state copy: ${label}`)
    }
    for (const selector of spec.requiredSelectors) {
        if (!snapshot.selectorCounts[selector]) reasons.push(`missing selector: ${selector}`)
    }
    const highContrastTokenHits = highContrastDarkTokens.filter(value => snapshot.classText.includes(value))
    for (const token of highContrastTokenHits) reasons.push(`high-contrast dark token: ${token}`)
    const contrastIssues = snapshot.contrastIssues
    for (const issue of contrastIssues) reasons.push(`low contrast ${issue.ratio.toFixed(2)}: ${issue.text} (${issue.selector})`)
    return { reasons, selectorCounts: snapshot.selectorCounts, bannedCopyList, highContrastTokenHits, contrastIssues }
}
