const maxCustomAptPackages = 12
const packageNamePattern = /^[a-z0-9][a-z0-9+.-]{0,127}$/

export function normalizeAptPackages(value: unknown): string[] | null {
    if (value === undefined) return []
    if (!Array.isArray(value) || value.length > maxCustomAptPackages
        || value.some(packageName => typeof packageName !== 'string' || !packageNamePattern.test(packageName))) return null
    return [...new Set(value as string[])].sort()
}
