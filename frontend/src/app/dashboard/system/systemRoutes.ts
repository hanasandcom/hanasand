export function systemExpiredSessionPath(page = '/system'): string {
    return `/logout?path=/login%3Fpath%3D${page}%26expired=true`
}
