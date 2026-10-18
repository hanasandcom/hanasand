export function assertDarkThemeSurface({
    source,
    requiredClasses,
    missingClassPrefix,
    bannedColorPattern,
    bannedColorMessage,
    requiredSources = [source],
}, violations) {
    for (const required of requiredClasses) {
        if (!requiredSources.some(requiredSource => requiredSource.includes(required))) {
            violations.push(`${missingClassPrefix}${required}`)
        }
    }

    bannedColorPattern.lastIndex = 0
    if (bannedColorPattern.test(source)) {
        violations.push(bannedColorMessage)
    }
    bannedColorPattern.lastIndex = 0
}
