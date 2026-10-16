export function safeRedirectPath(path: unknown): string {
    const value = String(path || '')
    if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard'
    return value
}
