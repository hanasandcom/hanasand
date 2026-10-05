export default function pathIsAllowedWhileUnauthorized(path: string) {
    if (path === '/api/db/queries'
        || path.startsWith('/dashboard')
        || path.startsWith('/admin')
        || path.startsWith('/editor')
        || path.startsWith('/organizations')) {
        return false
    }

    return true
}
