import { DashboardPage } from '@/components/dashboard/ui'
import { decodePublicTiHandoffPayload, PUBLIC_TI_HANDOFF_SOURCE } from '@/utils/ti/actorWorkbench'
import { buildPublicTiHandoffCase, type OperatorScope } from '../../operatorConsoleModel'
import AnalystWorkbenchClient from './workbenchClient'
import { attachCasesToAlerts, attachDeliveriesToAlerts, buildWorkbenchCases, emptyOrganizationState, loadDwmAlerts, loadDwmCases, loadDwmDeliveries } from './pageData'
import { firstParam, selectedWorkbenchCaseId } from './pageScope'

export const dynamic = 'force-dynamic'

export default async function TiAnalystWorkbenchPage({
    searchParams,
}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const params = await searchParams
    const [liveAlerts, liveCases, deliveries] = await Promise.all([
        loadDwmAlerts(),
        loadDwmCases(),
        loadDwmDeliveries(),
    ])
    const alertsWithCaseState = attachCasesToAlerts(liveAlerts, liveCases)
    const alertsWithDelivery = attachDeliveriesToAlerts(alertsWithCaseState, deliveries)
    const publicTiDecode = firstParam(params?.handoff) === PUBLIC_TI_HANDOFF_SOURCE
        ? decodePublicTiHandoffPayload(firstParam(params?.payload), firstParam(params?.intent))
        : null
    const scope: OperatorScope = { tenantId: 'default' }
    const publicTiCases = buildPublicTiHandoffCase({
        decode: publicTiDecode,
        scope,
        organizationState: emptyOrganizationState(),
        watchlists: [],
        operations: null,
        liveAlertCount: liveAlerts.length,
    })
    const cases = [...publicTiCases, ...buildWorkbenchCases(alertsWithDelivery, liveCases)]
    const initialSelectedId = selectedWorkbenchCaseId(cases, params) || publicTiCases[0]?.id

    return (
        <DashboardPage>
            <AnalystWorkbenchClient initialCases={cases} initialSelectedId={initialSelectedId} />
        </DashboardPage>
    )
}
