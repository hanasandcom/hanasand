'use client'

import postVM from '@/utils/vms/fetch/postVM'
import suggestVmSetup, { type VmWebsitePlan } from '@/utils/vms/fetch/suggestVmSetup'
import { useEffect, useId, useRef, useState } from 'react'
import { vmMinecraftServerTypes, vmOperatingSystems, vmResourceOptions, vmServiceGroups, vmServices } from '@/utils/vms/createOptions'
import type { NotifyVmAction } from '@/components/vms/vmActionFeedback'
import VmOperatingSystemPicker from './vmOperatingSystemPicker'
import VmWebsiteEditor from './vmWebsiteEditor'

const starterWebsitePlan: VmWebsitePlan = {
    title: 'Make this space yours.',
    tagline: 'A simple one-page website, ready for your content.',
    sections: [],
    gallery: [],
    contactEmail: '',
}

export default function VmCreateForm({ id, visible, organizationId, canCreate, permissionMessage, notify, onCreating, onCreated }: {
    id: string
    visible: boolean
    organizationId: string | null
    canCreate: boolean
    permissionMessage: string
    notify: NotifyVmAction
    onCreating: (creating: boolean) => void
    onCreated: (vm: VM | undefined, name: string) => void
}) {
    const nameInput = useRef<HTMLInputElement>(null)
    const promptId = useId()
    const [name, setName] = useState('')
    const [operatingSystem, setOperatingSystem] = useState<string>(vmOperatingSystems[0].id)
    const [resourcePlan, setResourcePlan] = useState<string>(vmResourceOptions[0].id)
    const [selectedServices, setSelectedServices] = useState<string[]>([])
    const [customAptPackages, setCustomAptPackages] = useState<string[]>([])
    const [minecraftEulaAccepted, setMinecraftEulaAccepted] = useState(false)
    const [minecraftServerType, setMinecraftServerType] = useState<typeof vmMinecraftServerTypes[number]['id']>('PAPER')
    const [setupPrompt, setSetupPrompt] = useState('')
    const [setupSuggestion, setSetupSuggestion] = useState('')
    const [suggestedSetupKey, setSuggestedSetupKey] = useState('')
    const [websitePlan, setWebsitePlan] = useState<VmWebsitePlan>(starterWebsitePlan)
    const [suggestingSetup, setSuggestingSetup] = useState(false)
    const [creating, setCreating] = useState(false)
    const [creationError, setCreationError] = useState('')
    const requiresLargePlan = operatingSystem === 'ubuntu-24.04-desktop'
    const requiresFourGiB = selectedServices.includes('minecraft-java')
    const availableResources = vmResourceOptions.filter(option => requiresLargePlan
        ? option.id === 'large'
        : !requiresFourGiB || option.memory !== '2GiB')
    const currentSetupKey = `${operatingSystem}\n${setupPrompt.trim()}`
    const unresolvedSetupPrompt = setupPrompt.trim().length >= 5 && suggestedSetupKey !== currentSetupKey
        && selectedServices.length === 0 && customAptPackages.length === 0

    useEffect(() => { if (visible) nameInput.current?.focus() }, [visible])

    async function create(event: React.FormEvent) {
        event.preventDefault()
        setCreationError('')
        setCreating(true)
        onCreating(true)
        notify('Creating virtual machine…', 'progress', 'vm-create')
        try {
            const vmName = name.trim()
            const resources = vmResourceOptions.find(option => option.id === resourcePlan) || vmResourceOptions[0]
            const result = await postVM({ name: vmName, os: operatingSystem, resources: { cpu: resources.cpu, memory: resources.memory, disk: resources.disk }, services: selectedServices, custom_apt_packages: customAptPackages, minecraft_eula_accepted: minecraftEulaAccepted, minecraft_server_type: selectedServices.includes('minecraft-java') ? minecraftServerType : undefined, website: selectedServices.includes('website') ? websitePlan : null, organization_id: organizationId || null })
            if (result.status !== 201) {
                setCreationError(result.message)
                notify(result.message, 'error', 'vm-create')
                return
            }
            notify(`${vmName} is queued. Follow setup in its terminal.`, 'success', 'vm-create')
            setName('')
            setCreationError('')
            setSelectedServices([])
            setCustomAptPackages([])
            setMinecraftEulaAccepted(false)
            setMinecraftServerType('PAPER')
            setSetupPrompt('')
            setSetupSuggestion('')
            setWebsitePlan(starterWebsitePlan)
            setSuggestedSetupKey('')
            onCreated(result.vm, vmName)
        } catch {
            setCreationError('Unable to create the virtual machine. Please try again.')
            notify('Unable to create the virtual machine. Please try again.', 'error', 'vm-create')
        } finally {
            setCreating(false)
            onCreating(false)
        }
    }

    async function suggestSetup() {
        setSuggestingSetup(true)
        setSetupSuggestion('')
        try {
            const plan = await suggestVmSetup(setupPrompt, operatingSystem)
            setSelectedServices(plan.services)
            if (plan.services.includes('minecraft-java') && resourcePlan === 'small') setResourcePlan('standard')
            setCustomAptPackages(plan.aptPackages)
            setSetupSuggestion(plan.summary)
            setWebsitePlan(plan.website || starterWebsitePlan)
            if (plan.minecraftServerType) setMinecraftServerType(plan.minecraftServerType)
            setSuggestedSetupKey(`${operatingSystem}\n${setupPrompt.trim()}`)
        } catch (error) {
            setSetupSuggestion(error instanceof Error ? error.message : 'Unable to suggest a VM setup.')
            setSuggestedSetupKey('')
        } finally { setSuggestingSetup(false) }
    }

    return <form id={id} onSubmit={create} className={visible ? 'grid gap-4 rounded-xl border border-ui-border bg-ui-canvas/50 p-4' : 'hidden'}>
        <div className='grid gap-2 rounded-lg border border-ui-border bg-ui-panel p-3'>
            <label htmlFor={promptId} className='text-sm font-medium text-ui-text'>Describe what you want to build</label>
            <div className='flex flex-wrap items-center gap-2'>
                <input id={promptId} value={setupPrompt} onChange={event => { setSetupPrompt(event.target.value); setSelectedServices([]); setMinecraftEulaAccepted(false); setWebsitePlan(starterWebsitePlan); setCustomAptPackages([]); setSetupSuggestion(''); setSuggestedSetupKey('') }} maxLength={1200} placeholder='A portfolio for a ceramic artist, or Node.js with PostgreSQL' disabled={creating || suggestingSetup} className='h-10 min-w-0 flex-1 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text placeholder:text-ui-muted' />
                <button type='button' onClick={suggestSetup} disabled={creating || suggestingSetup || setupPrompt.trim().length < 5} className='h-10 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-medium text-ui-text hover:bg-ui-panel disabled:opacity-50'>{suggestingSetup ? 'Creating…' : 'Generate setup'}</button>
            </div>
            {setupSuggestion && <p role='status' className='text-sm text-ui-muted'>{setupSuggestion}</p>}
            {customAptPackages.length > 0 && <p className='text-xs text-ui-muted'>Additional Ubuntu packages: {customAptPackages.join(', ')}</p>}
        </div>
        <div className='grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3'>
            <label className='grid min-w-0 gap-1 text-sm text-ui-muted'>VM name<input ref={nameInput} value={name} onChange={event => setName(event.target.value)} required pattern='[a-z][a-z0-9-]{0,61}[a-z0-9]' minLength={2} maxLength={63} title='2–63 lowercase letters, numbers or hyphens, starting with a letter' disabled={creating} className='h-10 w-full min-w-0 rounded-lg border border-ui-border bg-ui-raised px-3 text-ui-text' /></label>
            <VmOperatingSystemPicker value={operatingSystem} onChange={value => {
                setOperatingSystem(value)
                if (setupPrompt.trim()) {
                    setSelectedServices([])
                    setMinecraftEulaAccepted(false)
                    setMinecraftServerType('PAPER')
                    setWebsitePlan(starterWebsitePlan)
                }
                setCustomAptPackages([])
                setSuggestedSetupKey('')
                if (setupPrompt.trim()) setSetupSuggestion('The operating system changed. Generate the setup again to check package compatibility.')
                if (value === 'ubuntu-24.04-desktop') setResourcePlan('large')
            }} disabled={creating} />
            <label className='grid min-w-0 gap-1 text-sm text-ui-muted'>Resources<select value={resourcePlan} onChange={event => setResourcePlan(event.target.value)} disabled={creating} className='h-10 w-full min-w-0 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none focus-visible:ring-2 focus-visible:ring-ui-primary/20'>{availableResources.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        </div>
        {operatingSystem === 'ubuntu-24.04-desktop' && <p className='rounded-lg border border-ui-border bg-ui-panel px-3 py-2.5 text-xs leading-5 text-ui-muted'>After creation, open the VM's Access panel and use its SSH details with <code className='rounded bg-ui-raised px-1 py-0.5 text-ui-text'>-N -L 3389:127.0.0.1:3389</code> added. Then open Remote Desktop at <code className='rounded bg-ui-raised px-1 py-0.5 text-ui-text'>127.0.0.1:3389</code> and sign in with your VM username and password.</p>}
        <fieldset disabled={creating} className='grid gap-2'>
            <legend className='mb-1 text-sm font-medium text-ui-text'>Install services</legend>
            <div className='grid gap-3'>
                {vmServiceGroups.map(group => <section key={group} aria-label={`${group} services`} className='grid gap-2'>
                    <h3 className='text-xs font-medium uppercase tracking-wide text-ui-muted'>{group}</h3>
                    <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-4'>
                        {vmServices.filter(service => service.group === group).map(service => <label key={service.id} className='flex cursor-pointer items-start gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 py-2.5'>
                            <input type='checkbox' checked={selectedServices.includes(service.id)} onChange={event => {
                                setSelectedServices(current => event.target.checked ? [...current, service.id] : current.filter(id => id !== service.id))
                                if (service.id === 'minecraft-java' && event.target.checked && resourcePlan === 'small') setResourcePlan('standard')
                                if (service.id === 'minecraft-java' && !event.target.checked) setMinecraftEulaAccepted(false)
                            }} className='mt-1 accent-ui-primary' />
                            <span className='grid'><span className='text-sm font-medium text-ui-text'>{service.label}</span><span className='text-xs text-ui-muted'>{service.description}</span></span>
                        </label>)}
                    </div>
                </section>)}
            </div>
        </fieldset>
        {selectedServices.includes('minecraft-java') && <label className='flex items-start gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 py-2.5 text-sm text-ui-muted'><input type='checkbox' checked={minecraftEulaAccepted} onChange={event => setMinecraftEulaAccepted(event.target.checked)} className='mt-1 accent-ui-primary' /><span>I accept the <a href='https://www.minecraft.net/eula' target='_blank' rel='noopener noreferrer' className='font-medium text-ui-primary underline underline-offset-4'>Minecraft EULA</a>.</span></label>}
        {selectedServices.includes('website') && <VmWebsiteEditor plan={websitePlan} onChange={setWebsitePlan} disabled={creating} />}
        {selectedServices.includes('minecraft-java') && <label className='grid gap-1 text-sm text-ui-muted'>Server software<select value={minecraftServerType} onChange={event => setMinecraftServerType(event.target.value as typeof vmMinecraftServerTypes[number]['id'])} disabled={creating} className='h-10 max-w-sm rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none focus-visible:ring-2 focus-visible:ring-ui-primary/20'>{vmMinecraftServerTypes.map(type => <option key={type.id} value={type.id}>{type.label} · {type.description}</option>)}</select></label>}
        {!canCreate && <p role='status' className='rounded-lg border border-ui-border bg-ui-panel px-3 py-2.5 text-sm leading-5 text-ui-muted'>{permissionMessage}</p>}
        {unresolvedSetupPrompt && <p role='status' className='text-xs leading-5 text-ui-muted'>Generate a supported setup for this description, or clear it to create a blank VM.</p>}
        <button disabled={creating || !canCreate || unresolvedSetupPrompt} className='h-10 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary disabled:opacity-50'>{creating ? 'Creating VM…' : 'Create VM'}</button>
        {creationError && <p role='alert' className='rounded-lg border border-ui-danger/25 bg-ui-danger/5 px-3 py-2.5 text-sm leading-5 text-ui-danger'>{creationError}</p>}
    </form>
}
