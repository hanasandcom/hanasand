import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardPage } from 'hanasand/dashboard'
import { activeOrganizationId } from '@/utils/organizations/serverWorkspace'
import DeliveryClient from './deliveryClient'
import { firstSearchParam } from '../searchParams'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    const [store, params] = await Promise.all([cookies(), searchParams])
    const identityId = store.get('impersonating_id')?.value || store.get('id')?.value
    if (!identityId || !store.get('access_token')?.value) redirect('/login?path=%2Ffindings%2Factions')
    const requestedOrganizationId = firstSearchParam(params?.org) || firstSearchParam(params?.organizationId) || firstSearchParam(params?.orgId)
    const scopeId = requestedOrganizationId || await activeOrganizationId() || identityId
    return <DashboardPage><DeliveryClient key={scopeId} scopeId={scopeId} /></DashboardPage>
}
