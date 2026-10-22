'use client'

import { Plus, X } from 'lucide-react'
import { useCallback, useEffect, useId, useState } from 'react'
import VMRow from './vm'
import getVMs from '@/utils/vms/fetch/getVMs'
import { getCookie } from '@/utils/cookies/cookies'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardPanel } from '../dashboard/ui'
import VmFiltersButton from './vmFilters'
import { defaultVmFilters, filterVms, type VmFilters } from '@/utils/vms/filterVms'
import { useVmActionFeedback, VmActionFeedback } from '@/components/vms/vmActionFeedback'
import VmCreateForm from './vmCreateForm'
import { useWorkspace } from '@/components/organizations/workspaceProvider'

export default function VMs({ vms: serverVMs, initialNow }: { vms: VM[], initialNow: number }) {
    const [vms, setVms] = useState<VM[]>(serverVMs || [])
    const [now, setNow] = useState(initialNow)
    const router = useRouter()
    const [showCreate, setShowCreate] = useState(false)
    const createFormId = useId()
    const [creating, setCreating] = useState(false)
    const [filters, setFilters] = useState<VmFilters>(defaultVmFilters)
    const { items, notify, dismiss } = useVmActionFeedback()
    const { organizationId, organizations, loading: organizationsLoading, unavailable: organizationsUnavailable, organizationName } = useWorkspace()
    const activeOrganization = organizations.find(organization => organization.id === organizationId)
    const hasOrganizationContext = Boolean(organizationId || organizationName)
    const canCreateInWorkspace = !hasOrganizationContext || (!organizationsLoading && !organizationsUnavailable && ['owner', 'admin'].includes(activeOrganization?.role || ''))
    const createPermissionMessage = organizationsUnavailable
        ? 'Organization access could not be checked. Reload to try again.'
        : organizationsLoading
            ? 'Checking organization access…'
            : `Only an owner or admin of ${organizationName || 'this organization'} can create VMs.`
    const visibleVms = filterVms(vms, filters)
    const editorOptions = Array.from(new Set(vms.flatMap(vm => vm.access_users || []))).sort((a, b) => a.localeCompare(b))

    const update = useCallback(async () => {
        const id = getCookie('id')
        const impersonatingId = getCookie('impersonating_id')
        if (id) {
            const updatedVMs = await getVMs(impersonatingId || id, undefined, id, undefined, organizationId || undefined)
            setVms(updatedVMs)
            window.dispatchEvent(new Event('vms-updated'))
        } else {
            router.push('/login?path=/profile')
        }
    }, [organizationId, router])

    useEffect(() => { setVms(serverVMs || []) }, [serverVMs])

    useEffect(() => {
        setNow(Date.now())
        const timer = setInterval(() => setNow(Date.now()), 60000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        update()
        const refresh = setInterval(update, 60000)
        return () => clearInterval(refresh)
    }, [update])

    return (
        <DashboardPanel className='grid min-h-42 content-start gap-3 p-2 lg:p-4'>
            <div className='mb-1 flex items-center justify-between gap-3'>
                <div>
                    <h2 className='text-base font-semibold text-ui-text'>Virtual machines</h2>
                    <p className='mt-1 text-sm text-ui-muted'>{visibleVms.length === vms.length ? `${vms.length} virtual machine${vms.length === 1 ? '' : 's'}` : `${visibleVms.length} of ${vms.length} virtual machines`}</p>
                </div>
                <div className='flex shrink-0 items-center gap-2'>
                    <VmFiltersButton filters={filters} onChange={setFilters} editors={editorOptions} />
                    <button
                        type='button'
                        aria-label={showCreate ? 'Close VM creation controls' : 'Create VM'}
                        aria-expanded={showCreate}
                        aria-controls={createFormId}
                        disabled={creating}
                        onClick={() => setShowCreate(open => !open)}
                        className='flex h-8 w-8 items-center justify-center rounded-md border border-ui-border bg-ui-primary/10 text-ui-primary hover:bg-ui-primary/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary disabled:opacity-50'
                    >
                        {showCreate ? <X className='h-4 w-4' aria-hidden='true' /> : <Plus className='h-4 w-4' aria-hidden='true' />}
                    </button>
                </div>
            </div>

            {hasOrganizationContext && !canCreateInWorkspace && <p role='status' className='-mt-2 text-xs leading-5 text-ui-muted'>{createPermissionMessage}</p>}

            <VmCreateForm id={createFormId} visible={showCreate} organizationId={organizationId || null} canCreate={canCreateInWorkspace} permissionMessage={createPermissionMessage} notify={notify} onCreating={setCreating} onCreated={(vm, name) => {
                if (vm) setVms(current => [vm, ...current.filter(item => item.name !== name)])
                setShowCreate(false)
                router.push(`/vms/${encodeURIComponent(name)}/console?provisioning=1`)
            }} />
            {vms.length > 0 ? (
                visibleVms.length > 0 ? <div className='grid gap-2'>
                    {visibleVms.map(vm => <VMRow update={update} key={vm.name} vm={vm} now={now} onFeedback={notify} />)}
                </div> : <div className='rounded-xl border border-dashed border-ui-border bg-ui-canvas/50 px-4 py-8 text-center'>
                    <p className='text-sm font-medium text-ui-text'>No virtual machines match these filters.</p>
                    <button type='button' onClick={() => setFilters(defaultVmFilters)} className='mt-2 text-sm font-medium text-ui-primary hover:underline'>Clear filters</button>
                </div>
            ) : (
                <div className='flex flex-wrap gap-x-1 text-sm text-ui-muted'>
                    <span>VM controls are ready.</span>
                    <Link href='/s' className='font-semibold text-ui-primary underline underline-offset-4'>Create a project</Link>
                    <span>to provision one.</span>
                </div>
            )}
            <VmActionFeedback items={items} dismiss={dismiss} />
        </DashboardPanel>
    )
}
