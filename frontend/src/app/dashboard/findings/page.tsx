import { activeOrganizationId } from '@/utils/organizations/serverWorkspace'
import { DashboardPage } from 'hanasand/dashboard'
import type { DwmProductSnapshot } from '@/utils/dwm/product'
import { decodePublicTiHandoffPayload, PUBLIC_TI_HANDOFF_SOURCE } from '@/utils/ti/actorWorkbench'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import tokenIsValid from '@/utils/proxy/tokenIsValid'
import { Findings, type FindingsView } from './findings'
import { firstSearchParam } from './searchParams'

export const dynamic = 'force-dynamic'

export default async function DashboardDwmPage({
    searchParams,
}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const [params, cookieStore] = await Promise.all([searchParams, cookies()])
    const identityId = cookieStore.get('id')?.value
    const token = cookieStore.get('access_token')?.value
    if (!identityId || !token) {
        const returnPath = firstSearchParam(params?.panel) === 'watchlists' ? '/watchlists' : '/findings'
        redirect(`/login?path=${encodeURIComponent(returnPath)}`)
    }

    if (firstSearchParam(params?.panel) === 'actions') {
        const sharedOrg = firstSearchParam(params?.org) || firstSearchParam(params?.organizationId) || firstSearchParam(params?.orgId)
        redirect(sharedOrg ? `/findings/actions?org=${encodeURIComponent(sharedOrg)}` : '/findings/actions')
    }

    const organizationId = firstSearchParam(params?.org) || firstSearchParam(params?.organizationId) || firstSearchParam(params?.orgId) || await activeOrganizationId()
    const view = normalizeDwmView(firstSearchParam(params?.panel))
    if (firstSearchParam(params?.panel) === 'alerts') {
        const sharedOrg = firstSearchParam(params?.org) || firstSearchParam(params?.organizationId) || firstSearchParam(params?.orgId)
        redirect(sharedOrg ? `/cases?org=${encodeURIComponent(sharedOrg)}` : '/cases')
    }
    const tenantId = organizationId || identityId
    // This view has no internal-page controls, so it does not need the extra admin-access lookup.
    const session = view === 'watchlists' ? null : await tokenIsValid(token, identityId, cookieStore.get('impersonation_token')?.value)
    const isAdmin = session?.valid === true && session.canViewInternalPages === true
    const initialAlertId = firstSearchParam(params?.alert)
    const publicTiHandoff = firstSearchParam(params?.handoff) === PUBLIC_TI_HANDOFF_SOURCE
        ? decodePublicTiHandoffPayload(firstSearchParam(params?.payload), firstSearchParam(params?.intent))
        : null

    return (
        <DashboardPage className='gap-2 sm:gap-3'>
            <Findings
                key={`${tenantId}:${organizationId || 'personal'}`}
                tenantId={tenantId}
                organizationId={organizationId}
                snapshot={loadingSnapshot(tenantId)}
                operations={null}
                alerts={[]}
                deliveries={[]}
                dataHealth={loadingDataHealth()}
                initialAlertId={initialAlertId}
                publicTiHandoff={publicTiHandoff}
                isAdmin={isAdmin}
                view={view}
            />
        </DashboardPage>
    )
}

function loadingSnapshot(tenantId: string): DwmProductSnapshot {
    return {
        schemaVersion: 'dwm.product.v1',
        generatedAt: '',
        tenantId,
        watchlist: [],
        alerts: [],
        sourceCoverage: [],
        actorOverviews: [],
        onDemandQueue: [],
        readiness: {
            decision: 'blocked_missing_watchlist',
            blockers: ['Live monitoring state is loading.'],
            advantages: [],
            nextWorkItem: '',
        },
    }
}

function loadingDataHealth() {
    return {
        snapshot: { state: 'missing' as const, label: 'Monitoring loading', detail: 'Loading the persisted tenant watchlist and event state.' },
        operations: { state: 'missing' as const, label: 'Collection loading', detail: 'Loading retained source and capture state.' },
        alerts: { state: 'missing' as const, label: 'Events loading', detail: 'Loading recorded events.' },
        deliveries: { state: 'missing' as const, label: 'Deliveries loading', detail: 'Loading persisted delivery attempts.' },
    }
}

function normalizeDwmView(value: string | undefined): FindingsView {
    return value === 'watchlists' || value === 'sources' || value === 'delivery' || value === 'actors' || value === 'actions' ? value : 'overview'
}
