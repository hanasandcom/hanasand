import { formatClaimSummary } from '@/utils/dwm/display'
import type { DwmSourceFamily } from '@/utils/dwm/product'
import { isRecord } from '@/utils/isRecord'
export { isRecord }
export { caseDetailHref as caseDetailPath } from '../cases/caseRoutes'

export function durableDeliveryRows(payload: Record<string, unknown>) {
    const deliveries = Array.isArray(payload.deliveries) ? payload.deliveries : []
    return deliveries.filter((row): row is { status?: string, dryRun?: boolean, error?: unknown } => Boolean(row && typeof row === 'object'))
}

export function selectRebuiltAlert(payload: Record<string, unknown>, company: string, terms: string) {
    const alerts = Array.isArray(payload.alerts) ? payload.alerts.filter(isRecord) : []
    const needles = [company, ...terms.split(/[\n,]/)].map(item => item.trim().toLowerCase()).filter(Boolean)
    const match = alerts.find(alert => {
        const companyValue = readString(alert.company).toLowerCase()
        const matchedValue = readNestedString(alert, ['matchedTerm', 'value']).toLowerCase()
        const summary = rebuiltAlertSummary(alert).toLowerCase()
        return needles.some(needle => companyValue.includes(needle) || matchedValue.includes(needle) || summary.includes(needle))
    }) ?? alerts[0]
    const id = readString(match?.id)
    return id ? { id } : undefined
}

function rebuiltAlertSummary(alert: Record<string, unknown>) {
    return formatClaimSummary(readString(alert.claimSummary), {
        actor: readString(alert.actor),
        artifactType: readString(alert.artifactType),
        company: readString(alert.company),
        matchedTerm: { value: readNestedString(alert, ['matchedTerm', 'value']), kind: 'unknown' },
        sourceFamily: readSourceFamily(alert.sourceFamily),
    })
}

function readSourceFamily(value: unknown): DwmSourceFamily {
    const sourceFamily = readString(value)
    if (sourceFamily === 'telegram_public' || sourceFamily === 'darkweb_metadata' || sourceFamily === 'actor_page' || sourceFamily === 'public_advisory' || sourceFamily === 'clear_web') {
        return sourceFamily
    }
    return 'darkweb_metadata'
}

export function readNestedString(value: unknown, path: string[]) {
    let cursor = value
    for (const part of path) {
        if (!isRecord(cursor)) return ''
        cursor = cursor[part]
    }
    return readString(cursor)
}

export function readString(value: unknown) {
    return typeof value === 'string' ? value : ''
}

export function readNumber(value: unknown, key: string) {
    if (!isRecord(value)) return 0
    const candidate = value[key]
    return typeof candidate === 'number' ? candidate : 0
}

export function readSummaryNumber(value: Record<string, unknown>, key: string) {
    const summary = value.summary
    if (!isRecord(summary)) return 0
    const candidate = summary[key]
    return typeof candidate === 'number' ? candidate : 0
}
