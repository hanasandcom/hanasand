import type { ProductNorthStarRow, ProductNorthStarOwnerBlocker, ProductNorthStarProofDrilldown, ProductNorthStarRowId } from './northStarTypes'
import type { ReadinessStatus } from './readinessTypes'
import { uniqueStrings } from './northStarRows'

export function buildOwnerBlockers(rows: ProductNorthStarRow[]): ProductNorthStarOwnerBlocker[] {
    const byOwner = new Map<string, ProductNorthStarRow[]>()
    for (const row of rows) {
        byOwner.set(row.ownerLane, [...(byOwner.get(row.ownerLane) || []), row])
    }
    return Array.from(byOwner.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([ownerLane, ownerRows]) => ({
            ownerLane,
            rowIds: uniqueStrings(ownerRows.map(row => row.id)) as ProductNorthStarRowId[],
            states: uniqueStrings(ownerRows.map(row => row.state)).filter((state): state is Exclude<ReadinessStatus, 'ready'> => state !== 'ready'),
            proofContracts: uniqueStrings(ownerRows.flatMap(row => row.backendProofContractVersion.split(' + '))),
            workflowRoutes: uniqueStrings(ownerRows.map(row => row.href)),
        }))
}

export function sameOwnerBlockers(blockers: ProductNorthStarOwnerBlocker[], rows: ProductNorthStarRow[]) {
    const expected = buildOwnerBlockers(rows)
    if (!sameStringSet(blockers.map(blocker => blocker.ownerLane), expected.map(blocker => blocker.ownerLane))) return false
    return expected.every(expectedBlocker => {
        const actual = blockers.find(blocker => blocker.ownerLane === expectedBlocker.ownerLane)
        return Boolean(actual)
            && sameStringSet(actual?.rowIds || [], expectedBlocker.rowIds)
            && sameStringSet(actual?.states || [], expectedBlocker.states)
            && sameStringSet(actual?.proofContracts || [], expectedBlocker.proofContracts)
            && sameStringSet(actual?.workflowRoutes || [], expectedBlocker.workflowRoutes)
    })
}

export function proofRoutesByKind(drilldowns: ProductNorthStarProofDrilldown[], kind: ProductNorthStarProofDrilldown['kind']) {
    return uniqueStrings(drilldowns
        .filter(item => item.kind === kind)
        .map(item => item.href))
}

export function withProofFreshness(row: Omit<ProductNorthStarRow, 'proofAgeSeconds' | 'proofStale' | 'proofDrilldowns'>): ProductNorthStarRow {
    const proofAgeSeconds = ageSecondsSince(row.proofTimestamp)
    return {
        ...row,
        proofAgeSeconds,
        proofStale: proofAgeSeconds > row.staleAfterSeconds,
        proofDrilldowns: proofDrilldownsFor(row),
    }
}

export function ageSecondsSince(value: string) {
    const timestamp = new Date(value).getTime()
    if (!value || Number.isNaN(timestamp)) return 0
    return Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
}

export function proofDrilldownsFor(row: Omit<ProductNorthStarRow, 'proofAgeSeconds' | 'proofStale' | 'proofDrilldowns'>): ProductNorthStarProofDrilldown[] {
    const apiRoute = firstLocalRoute(row.proofSource)
    const probeRoute = firstLocalRoute(row.integrationProbeHint)
    return [
        {
            kind: 'workflow',
            label: 'Workflow',
            value: row.href,
            href: linkableRoute(row.href) ? row.href : '',
        },
        {
            kind: 'api',
            label: 'Status API',
            value: apiRoute || row.proofSource || row.integrationProbeHint,
            href: linkableRoute(apiRoute) ? apiRoute : '',
        },
        {
            kind: 'probe',
            label: 'Probe route',
            value: probeRoute || row.integrationProbeHint,
            href: linkableRoute(probeRoute) ? probeRoute : '',
        },
        {
            kind: 'contract',
            label: 'Integration',
            value: row.backendProofContractVersion,
            href: '',
        },
        {
            kind: 'dashboard_row',
            label: 'Dashboard row',
            value: row.expectedDashboardRowId,
            href: '',
        },
    ]
}

export function firstLocalRoute(...values: string[]) {
    for (const value of values) {
        const routes = value.match(/\/(?:api|dashboard|ti|status)[^\s,;'"`)]+/g) || []
        const route = routes.map(cleanRoute).find(Boolean)
        if (route) return route
    }
    return ''
}

export function cleanRoute(value: string) {
    return value.replace(/[.。]+$/g, '')
}

export function linkableRoute(value: string | undefined) {
    return Boolean(value && value.startsWith('/') && !value.includes(':') && !value.includes('<') && !value.includes('>'))
}

export function sameStringSet(left: string[], right: string[]) {
    const cleanLeft = Array.from(new Set(left.filter(Boolean))).sort()
    const cleanRight = Array.from(new Set(right.filter(Boolean))).sort()
    return cleanLeft.length === cleanRight.length && cleanLeft.every((value, index) => value === cleanRight[index])
}

export function sameDrilldowns(left: ProductNorthStarProofDrilldown[], right: ProductNorthStarProofDrilldown[]) {
    return JSON.stringify(left) === JSON.stringify(right)
}
