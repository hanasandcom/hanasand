export default function pathIsAllowedWhileUnauthorized(path: string) {
    if (path === '/api/db/queries'
        || path === '/api/ti/scraper/control'
        || path.startsWith('/dashboard')
        || path.startsWith('/admin')
        || path.startsWith('/editor')
        || path.startsWith('/organizations')) {
        return false
    }

    return true
}
