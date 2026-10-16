import Link from 'next/link'
import { ArrowUpRight, Inbox, Radar } from 'lucide-react'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
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
            <DashboardHeader
                eyebrow='Attack review'
                title='Attacks'
                description='Triage active exposure cases, inspect evidence, assign owners, and send findings when they are ready.'
                actions={(
                    <div className='flex flex-wrap gap-2'>
                        <Link href='/findings' className='inline-flex h-10 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-panel'>
                            <Radar className='h-4 w-4' />
                            Dark web cases
                        </Link>
                        <Link href='/ti/sources' className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-3 text-sm font-semibold text-ui-on-primary transition hover:opacity-90'>
                            <Inbox className='h-4 w-4' />
                            Sources
                            <ArrowUpRight className='h-4 w-4' />
                        </Link>
                    </div>
                )}
            />

            <AnalystWorkbenchClient initialCases={cases} initialSelectedId={initialSelectedId} />
        </DashboardPage>
    )
}
