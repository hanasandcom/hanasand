'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Copy, LoaderCircle, Plus, Trash2 } from 'lucide-react'
import { VmPanel } from './vmPanel'
import { requestVmPublicServices, type VmPublicService, type VmPublicServicesResponse } from '@/utils/vms/fetch/publicServices'

const maxPublicServicesPerVm = 1000

export default function VmPublicServices({ vmName }: { vmName: string }) {
    const [services, setServices] = useState<VmPublicService[]>([])
    const [canManage, setCanManage] = useState(false)
    const [name, setName] = useState('')
    const [type, setType] = useState<VmPublicService['type']>('minecraft-java')
    const [port, setPort] = useState('25565')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    async function load() {
        try {
            const result = await requestVmPublicServices(vmName, 'GET')
            const response = result as VmPublicServicesResponse
            setServices(Array.isArray(response.services) ? response.services : [])
            setCanManage(response.canManage === true)
            setError('')
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load public services.') }
        finally { setLoading(false) }
    }

    useEffect(() => { void load() }, [vmName])

    async function create(event: FormEvent) {
        event.preventDefault()
        setSaving(true); setError(''); setNotice('')
        try {
            const created = await requestVmPublicServices(vmName, 'POST', { name, type, port: Number(port) }) as VmPublicService
            setServices(current => [...current, created]); setName(''); setNotice('Public address added. It will be ready after the route refreshes.')
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to add this address.') }
        finally { setSaving(false) }
    }

    async function remove(service: VmPublicService) {
        setError(''); setNotice('')
        try {
            await requestVmPublicServices(vmName, 'DELETE', service.id)
            setServices(current => current.filter(item => item.id !== service.id)); setNotice(`${service.hostname || service.name} removed.`)
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to remove this address.') }
    }

    return <VmPanel title='Public services'>
        <p className='mt-2 max-w-3xl text-sm leading-6 text-ui-muted'>Give a service a hostname on port 443. Websites use the Hanasand HTTPS gateway; Minecraft Java uses its server address; TLS services keep their own encryption.</p>
        <p className='mt-1 text-xs leading-5 text-ui-muted'>VMs do not have individual public IPv6 addresses. Use the shared 443 gateway here; the guest port stays private.</p>
        {canManage && <form onSubmit={create} className='mt-4 grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-3 sm:grid-cols-[minmax(0,1fr)_minmax(140px,0.8fr)_110px_auto] sm:items-end'>
            <label className='grid gap-1 text-xs font-medium text-ui-muted'>Service name
                <span className='flex h-10 items-center rounded-md border border-ui-border bg-ui-panel px-2 text-sm text-ui-text'><input value={name} onChange={event => setName(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40))} required minLength={1} maxLength={40} placeholder='survival' className='min-w-0 flex-1 bg-transparent outline-none' /><span className='text-ui-muted'>.hanasand.com</span></span>
            </label>
            <label className='grid gap-1 text-xs font-medium text-ui-muted'>Service type
                <select value={type} onChange={event => { const next = event.target.value as VmPublicService['type']; setType(next); setPort(next === 'minecraft-java' ? '25565' : next === 'http' ? '80' : '443') }} className='h-10 rounded-md border border-ui-border bg-ui-panel px-2 text-sm text-ui-text'>
                    <option value='http'>Website (HTTP)</option><option value='minecraft-java'>Minecraft Java</option><option value='tls'>TLS over TCP</option>
                </select>
            </label>
            <label className='grid gap-1 text-xs font-medium text-ui-muted'>Guest port
                <input type='number' inputMode='numeric' min='1' max='65535' value={port} onChange={event => setPort(event.target.value)} required className='h-10 rounded-md border border-ui-border bg-ui-panel px-2 text-sm text-ui-text' />
            </label>
            <button type='submit' disabled={saving || services.length >= maxPublicServicesPerVm} className='inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ui-primary/40 bg-ui-primary/10 px-3 text-sm font-semibold text-ui-primary disabled:opacity-50'>{saving ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <Plus className='h-4 w-4' />}Add</button>
        </form>}
        <p className='mt-2 text-xs leading-5 text-ui-muted'>For SSH, use the connection command above. Other plain TCP or UDP protocols need their own port or a protocol-specific proxy; a hostname alone cannot identify them on 443.</p>
        {error && <p role='alert' className='mt-3 text-sm text-ui-danger'>{error}</p>}{notice && <p role='status' className='mt-3 text-sm text-ui-muted'>{notice}</p>}
        {loading ? <p className='mt-4 text-sm text-ui-muted'>Loading public services…</p> : services.length ? <ul className='mt-4 divide-y divide-ui-border'>
            {services.map(service => <li key={service.id} className='flex flex-wrap items-center justify-between gap-3 py-3'>
                <div className='min-w-0'>{service.hostname ? service.type === 'http' ? <a href={`https://${service.hostname}`} target='_blank' rel='noopener noreferrer' className='font-medium text-ui-primary underline-offset-4 hover:underline'>{service.hostname}</a> : <p className='font-medium text-ui-text'>{service.hostname}:443</p> : <p className='font-medium text-ui-text'>{service.name} <span className='text-ui-muted'>(hostname unavailable)</span></p>}<p className='mt-1 text-xs text-ui-muted'>{service.type === 'minecraft-java' ? 'Minecraft Java' : service.type === 'http' ? 'Website · HTTPS' : 'TLS over TCP'} → guest port {service.port}</p></div>
                <div className='flex items-center gap-2'>{service.hostname && <button type='button' aria-label={`Copy ${service.hostname}`} onClick={() => void navigator.clipboard.writeText(`${service.hostname}:443`)} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-2 text-xs text-ui-text hover:bg-ui-raised'><Copy className='h-3.5 w-3.5' />Copy</button>}{canManage && <button type='button' aria-label={`Remove ${service.name}`} onClick={() => void remove(service)} className='inline-flex h-9 items-center rounded-md border border-ui-border bg-ui-panel px-2 text-ui-muted hover:border-ui-danger/50 hover:text-ui-danger'><Trash2 className='h-4 w-4' /></button>}</div>
            </li>)}
        </ul> : <p className='mt-4 text-sm text-ui-muted'>No public services yet.</p>}
        {type === 'tls' && <p className='mt-2 text-xs leading-5 text-ui-muted'>The client must start TLS and send this hostname as SNI. Plain SSH and UDP need a different route.</p>}
    </VmPanel>
}
