'use client'

import AddToOrganization from '../vms/addToOrganization'

import Link from 'next/link'
import { useState } from 'react'
import DeleteVmDialog from '../vms/deleteVmDialog'
import restoreVM from '@/utils/vms/fetch/restoreVM'
import deleteVM from '@/utils/vms/fetch/deleteVM'
import { ArrowRight, Cpu, HardDrive, Menu, Network, TerminalSquare, Trash2 } from 'lucide-react'
import formatUtcDateTime from '@/utils/date/formatUtcDateTime'
import formatDescription from '@/utils/vms/formatDescription'
import formatStatus from '@/utils/vms/formatStatus'
import { useRouter } from 'next/navigation'
import RestartButtons from '../vms/restartButtons'
import { vmActionStyle } from '../vms/actionStyle'
import VMSudoPassword from '../vms/vmSudoPassword'
import VMConnectLocally from '../vms/vmConnectLocally'
import type { NotifyVmAction } from '../vms/vmActionFeedback'

export default function VMRow({ vm, update, now, onFeedback }: { vm: VM, update: () => void, now: number, onFeedback?: NotifyVmAction }) {
    const router = useRouter()
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const [busy, setBusy] = useState(false)
    const deleted = Boolean(vm.deleted_at)
    const expired = Boolean(vm.delete_after && new Date(vm.delete_after).getTime() <= now)
    const instanceMissing = vm.deletion_restore?.instanceMissing === true
    const name = vm.name || 'Unnamed virtual machine'
    const ip = vm.device_eth0_ipv4_address || 'IP pending'
    const status = deleted ? 'Scheduled for deletion' : formatStatus(vm.status) || 'Syncing'
    const os = [vm.config_image_os, vm.config_image_version].filter(Boolean).join(' ')
    const image = os || formatDescription(vm.config_image_description)
    const lastUsed = vm.last_used ? formatUtcDateTime(vm.last_used) : vm.last_checked ? `Checked ${formatUtcDateTime(vm.last_checked)}` : 'Telemetry pending'
    const rawStatusNote = (vm as VM & { status_reason?: string }).status_reason || ''
    const statusNote = status === 'Provisioning' || status === 'Stopped' && /^VM is stopped\.?$/i.test(rawStatusNote.trim()) ? '' : rawStatusNote
    const editors = vm.access_users?.length || 0

    function openDetails() {
        if (!vm.name) {
            onFeedback?.('This virtual machine is missing its instance name.', 'error')
            return
        }
        router.push(`/vm/${vm.name}`)
    }

    async function handleDelete(confirmation: string) {
        if (!vm.name || busy) return
        setBusy(true)
        onFeedback?.(`Scheduling ${vm.name} for deletion…`, 'progress', `vm-${vm.name}-delete`)
        try {
            const result = await deleteVM(vm.name, confirmation)
            if (result.status === 200) {
                setConfirmingDelete(false)
                onFeedback?.(`${vm.name} is scheduled for deletion.`, 'success', `vm-${vm.name}-delete`)
            } else {
                onFeedback?.(result.message, 'error', `vm-${vm.name}-delete`)
            }
            update()
        } catch {
            const message = 'Unable to schedule this VM for deletion. Check its current status and try again.'
            onFeedback?.(message, 'error', `vm-${vm.name}-delete`)
        } finally { setBusy(false) }
    }

    async function handleRestore() {
        if (busy) return
        setBusy(true)
        onFeedback?.(`Restoring ${name}…`, 'progress', `vm-${name}-restore`)
        try {
            const result = await restoreVM(name)
            if (result.status >= 200 && result.status < 300) {
                onFeedback?.(`${name} was restored.`, 'success', `vm-${name}-restore`)
                update()
            } else onFeedback?.(result.message, 'error', `vm-${name}-restore`)
        } catch {
            onFeedback?.(`Unable to restore ${name}. Please try again.`, 'error', `vm-${name}-restore`)
        } finally { setBusy(false) }
    }

    return (
        <>
            <article className='grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-4 transition-colors hover:bg-ui-panel sm:gap-4'>
                <div className='grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start'>
                    <div className='min-w-0'>
                        <div className='flex min-w-0 flex-wrap items-center gap-2'>
                            <h3 className='min-w-0 wrap-break-word text-base font-semibold text-ui-text'>{name}</h3>
                            {vm.managed === true && <span title='Provisioned through a share' className='rounded-md border border-ui-border bg-ui-canvas px-2 py-0.5 text-[0.68rem] font-semibold text-ui-muted'>Managed</span>}
                            <span className={`rounded-md px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] ${status === 'Running'
                                ? 'border border-ui-success/30 bg-ui-success/10 text-ui-success'
                                : status === 'Stopped'
                                    ? 'border border-ui-border bg-ui-canvas text-ui-muted'
                                    : 'border border-ui-warning/30 bg-ui-warning/10 text-ui-warning'
                            }`}>{status}</span>
                        </div>
                        {statusNote && <p className='mt-1 text-xs leading-5 text-ui-muted'>{statusNote}</p>}
                    </div>
                    <div className='flex w-full max-w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap sm:justify-end'>
                        {!deleted && <>
                            <RestartButtons vm={vm} onFeedback={onFeedback} showLabels />
                            <Link href={`/vms/${encodeURIComponent(name)}/console`} aria-label={`Open ${name} console`} title='Open console' className={`${vmActionStyle} w-auto px-2.5 text-ui-primary`}>
                                <TerminalSquare className='h-4 w-4' /> <span>Console</span>
                            </Link>
                            <button type='button' onClick={openDetails} className={`${vmActionStyle} px-3 text-ui-primary`} data-vm-primary-action>
                                Open details <ArrowRight className='h-4 w-4' />
                            </button>
                            {vm.name && <VMConnectLocally vmName={vm.name} className={`${vmActionStyle} max-sm:hidden px-3 text-ui-text`} />}
                            {vm.name && <VMSudoPassword vmName={vm.name} compact triggerClassName={`${vmActionStyle} max-sm:hidden px-3 text-ui-primary`} />}
                            <details className='relative w-full sm:w-auto' data-vm-actions data-vm-danger-actions>
                                <summary aria-label={`More actions for ${name}`} title='More actions' className={`${vmActionStyle} ml-auto w-9 cursor-pointer list-none text-ui-muted [&::-webkit-details-marker]:hidden sm:ml-0`}>
                                    <Menu className='h-4 w-4' />
                                </summary>
                                <div className='absolute right-0 top-11 z-20 grid min-w-56 gap-2 rounded-lg border border-ui-border bg-ui-panel p-2 shadow-lg'>
                                    <AddToOrganization vm={vm} onAdded={update} onFeedback={onFeedback} />
                                    {vm.name && <VMConnectLocally vmName={vm.name} className={`${vmActionStyle} w-full justify-start px-3 text-ui-text sm:hidden`} />}
                                    {vm.name && <VMSudoPassword vmName={vm.name} compact triggerClassName={`${vmActionStyle} w-full justify-start px-3 text-ui-primary sm:hidden`} />}
                                    <button type='button' onClick={() => setConfirmingDelete(true)} className={`${vmActionStyle} justify-start px-3 text-ui-danger`}>
                                        <Trash2 className='h-4 w-4' /> Delete VM
                                    </button>
                                </div>
                            </details>
                        </>}
                    </div>
                </div>
                <div className='grid gap-x-4 gap-y-3 border-t border-ui-border pt-3 text-sm sm:grid-cols-2 xl:grid-cols-4'>
                    <div className='min-w-0'><p className='text-xs font-medium text-ui-muted'>IP address</p><p className='mt-1 wrap-break-word text-ui-text'>{ip}</p></div>
                    <div className='min-w-0'><p className='text-xs font-medium text-ui-muted'>{vm.organization_id ? 'Organization' : 'Owner'}</p><p className='mt-1 wrap-break-word text-ui-text'>{vm.organization_id ? vm.organization_name || 'Unknown' : vm.owner || vm.created_by || 'Unknown'}</p></div>
                    <div className='min-w-0'><p className='text-xs font-medium text-ui-muted'>Last used</p><p className='mt-1 wrap-break-word text-ui-text'>{lastUsed}</p></div>
                    <div className='min-w-0'><p className='text-xs font-medium text-ui-muted'>{vm.organization_id ? 'Access' : 'Editors'}</p><p className='mt-1 wrap-break-word text-ui-text'>{vm.organization_id ? 'Organization members' : `${editors} editor${editors === 1 ? '' : 's'}`}</p></div>
                </div>
                <div className='flex min-w-0 flex-wrap gap-2 text-xs text-ui-muted'>
                    <span title='Virtual machine' className='inline-flex items-center rounded border border-ui-border bg-ui-raised px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-ui-muted'>VM</span>
                    <span className='inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-ui-border bg-ui-canvas px-2.5 py-1.5'><HardDrive className='h-3.5 w-3.5 shrink-0' /><span className='wrap-break-word'>{image}</span></span>
                    <span className='inline-flex items-center gap-1.5 rounded-md border border-ui-border bg-ui-canvas px-2.5 py-1.5'><Cpu className='h-3.5 w-3.5' /><span>{vm.limits_cpu ? `${vm.limits_cpu} CPU` : 'CPU pending'}</span></span>
                    <span className='inline-flex items-center gap-1.5 rounded-md border border-ui-border bg-ui-canvas px-2.5 py-1.5'><Network className='h-3.5 w-3.5' /><span>{vm.limits_memory || 'Memory pending'}</span></span>
                </div>
                {deleted && <div className='rounded-lg border border-ui-warning/30 bg-ui-warning/10 p-3 text-sm'>
                    <p>{expired
                        ? 'Recovery period ended. Permanent deletion is pending.'
                        : instanceMissing
                            ? `The VM record will be permanently deleted after ${formatUtcDateTime(vm.delete_after)}.`
                            : `Restore before ${formatUtcDateTime(vm.delete_after)}.`}</p>
                    <p className='mt-1 text-ui-muted'>{instanceMissing
                        ? 'The VM instance was already absent from its host. Its disk cannot be restored.'
                        : vm.deletion_error
                            ? 'Dashboard access is blocked. The host is retrying the shutdown.'
                            : 'The VM is disabled while scheduled for deletion.'}</p>
                    {vm.deletion_error && !instanceMissing && <p role='alert' className='mt-2 text-ui-text'>The host operation failed: {vm.deletion_error}</p>}
                    {!instanceMissing && <button type='button' disabled={busy || expired} onClick={() => void handleRestore()} className={`${vmActionStyle} mt-3 bg-ui-raised px-3 text-ui-text hover:bg-ui-canvas`}>{busy ? 'Restoring…' : 'Restore VM'}</button>}
                </div>}
            </article>
            {confirmingDelete && <DeleteVmDialog name={name} busy={busy} onCancel={() => setConfirmingDelete(false)} onConfirm={confirmation => void handleDelete(confirmation)} />}
        </>
    )
}
