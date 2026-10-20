'use client'

import postVM from '@/utils/vms/fetch/postVM'
import { Plus, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import VMRow from './vm'
import getVMs from '@/utils/vms/fetch/getVMs'
import { getCookie } from '@/utils/cookies/cookies'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardPanel } from '../dashboard/ui'
import VmFiltersButton from './vmFilters'
import { defaultVmFilters, filterVms, type VmFilters } from '@/utils/vms/filterVms'
import { useVmActionFeedback, VmActionFeedback } from '@/components/vms/vmActionFeedback'

export default function VMs({ vms: serverVMs, initialNow }: { vms: VM[], initialNow: number }) {
    const [vms, setVms] = useState<VM[]>(serverVMs || [])
    const [now, setNow] = useState(initialNow)
    const router = useRouter()
    const [showCreate, setShowCreate] = useState(false)
    const createFormId = useId()
    const nameInput = useRef<HTMLInputElement>(null)
    const [name, setName] = useState('')
    const [creating, setCreating] = useState(false)
    const [filters, setFilters] = useState<VmFilters>(defaultVmFilters)
    const { items, notify, dismiss } = useVmActionFeedback()
    const visibleVms = filterVms(vms, filters)
    const editorOptions = Array.from(new Set(vms.flatMap(vm => vm.access_users || []))).sort((a, b) => a.localeCompare(b))

    async function create(event: React.FormEvent) {
        event.preventDefault()
        setCreating(true)
        notify('Creating virtual machine…', 'progress', 'vm-create')
        try {
            const result = await postVM({ name: name.trim() })
            if (result.status === 201) {
                notify(`Created ${name.trim()}.`, 'success', 'vm-create')
                setName('')
                void update().catch(() => notify('The VM was created, but the list could not be refreshed.', 'info', 'vm-create-refresh'))
            } else notify(result.message, 'error', 'vm-create')
        } catch {
            notify('Unable to create the virtual machine. Please try again.', 'error', 'vm-create')
        } finally { setCreating(false) }
    }

    async function update() {
        const id = getCookie('id')
        const impersonatingId = getCookie('impersonating_id')
        if (id) {
            const updatedVMs = await getVMs(impersonatingId || id, undefined, id)
            setVms(updatedVMs)
            window.dispatchEvent(new Event('vms-updated'))
        } else {
            return router.push('/login?path=/profile')
        }
    }

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
    }, [])

    useEffect(() => {
        if (showCreate) nameInput.current?.focus()
    }, [showCreate])

    return (
        <DashboardPanel className='grid min-h-42 content-start gap-3 p-4'>
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

            <form id={createFormId} onSubmit={create} className={showCreate ? 'flex flex-wrap items-end gap-2' : 'hidden'}>
                <label className='grid gap-1 text-sm text-ui-muted'>VM name<input ref={nameInput} value={name} onChange={event => setName(event.target.value)} required pattern='[a-z][a-z0-9-]{0,61}[a-z0-9]' minLength={2} maxLength={63} title='2–63 lowercase letters, numbers or hyphens, starting with a letter' disabled={creating} className='h-10 rounded-lg border border-ui-border bg-ui-raised px-3 text-ui-text' /></label>
                <button disabled={creating} className='h-10 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary disabled:opacity-50'>{creating ? 'Creating VM…' : 'Create VM'}</button>
            </form>
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
