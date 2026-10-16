export function linkFromText(value?: string) {
    if (!value) return undefined
    const match = value.match(/\bhttps?:\/\/[^\s<>"']+/i)
    if (!match) return undefined
    try {
        const url = new URL(match[0])
        if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString()
    } catch {
        return undefined
    }
    return undefined
}

export function consumerRequestPathLabel(value: string) {
    if (value.includes('alert-readiness')) return 'org alert state'
    if (value.includes('/api/organizations') && value.includes('watchlists')) return 'org watchlist action'
    if (value.includes('/v1/dwm/watchlists')) return 'watchlist action'
    if (value.includes('/v1/dwm/alerts')) return 'alert action'
    if (value.includes('/v1/cases')) return 'case action'
    if (value.includes('/v1/dwm/webhooks')) return 'delivery action'
    return sourceRequestRouteLabel(value)
}

export function consumerRequestActionLabel(method: string, path: string) {
    return `${method.toUpperCase()} ${consumerRequestPathLabel(path)}`
}

export function sourceRequestRouteLabel(value: string) {
    if (value === '/ti/profiles') return 'source review'
    return 'review action'
}

export function actionOwnerLabel(value: string) {
    if (value === 'org') return 'watchlist'
    if (value === 'alert') return 'alerting'
    if (value === 'case') return 'casework'
    if (value === 'source') return 'source review'
    return 'review'
}
