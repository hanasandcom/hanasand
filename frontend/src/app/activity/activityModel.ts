import type { ExposureQueueItem } from '../exposureQueue'

export type ActivityFilters = {
    q: string
    company: string
    actor: string
    category: string
    size: string
    country: string
    from: string
    to: string
}

export function emptyActivityFilters(): ActivityFilters {
    return { q: '', company: '', actor: '', category: '', size: '', country: '', from: '', to: '' }
}

export function applyActivityFilters(items: ExposureQueueItem[], filters: ActivityFilters) {
    const q = filters.q.trim().toLowerCase()
    const company = filters.company.trim().toLowerCase()
    const actor = filters.actor.trim().toLowerCase()
    const category = filters.category.trim().toLowerCase()
    const size = filters.size.trim().toLowerCase()
    const country = filters.country.trim().toLowerCase()
    const from = filters.from ? Date.parse(`${filters.from}T00:00:00.000Z`) : null
    const to = filters.to ? Date.parse(`${filters.to}T23:59:59.999Z`) : null

    return items.filter(item => {
        const time = Date.parse(item.claimTime || item.collectedAt || '')
        const haystack = [item.actor, item.company, item.claimedData, item.claimedDataSize, item.country, item.sourceName].join(' ').toLowerCase()
        if (q && !haystack.includes(q)) return false
        if (company && !item.company.toLowerCase().includes(company)) return false
        if (actor && !item.actor.toLowerCase().includes(actor)) return false
        if (category && !item.claimedData.toLowerCase().includes(category)) return false
        if (size && !item.claimedDataSize.toLowerCase().includes(size)) return false
        if (country && !(item.country || '').toLowerCase().includes(country)) return false
        if (from !== null && (!Number.isFinite(time) || time < from)) return false
        if (to !== null && (!Number.isFinite(time) || time > to)) return false
        return true
    })
}

export function activityFiltersFromUrl(params: URLSearchParams): ActivityFilters {
    return {
        q: params.get('q') || '',
        company: params.get('company') || '',
        actor: params.get('actor') || '',
        category: params.get('category') || params.get('data') || '',
        size: params.get('size') || '',
        country: params.get('country') || '',
        from: params.get('from') || '',
        to: params.get('to') || '',
    }
}

export function activityFiltersToUrl(filters: ActivityFilters) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value)
    }
    return params
}

export function activityStatus(status: string, visible: number, total: number) {
    if (status === 'unavailable') return 'Live activity unavailable'
    if (status === 'checking') return 'Checking live activity'
    if (status === 'stale') return `${visible}/${total} loaded · feed stale`
    return `${visible}/${total} loaded`
}

export function emptyActivityTitle(status: string) {
    if (status === 'checking') return 'Checking live activity.'
    if (status === 'unavailable') return 'Activity is temporarily unavailable.'
    return 'No rows match these filters.'
}

export function emptyActivityDetail(status: string) {
    if (status === 'checking') return 'Existing records will appear when the live feed responds.'
    if (status === 'unavailable') return 'The activity service did not respond. Existing records have not been deleted.'
    return 'Clear a filter or scroll/load more activity before narrowing again.'
}
