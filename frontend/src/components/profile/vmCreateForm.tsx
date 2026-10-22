'use client'

import postVM from '@/utils/vms/fetch/postVM'
import suggestVmSetup, { type VmWebsitePlan } from '@/utils/vms/fetch/suggestVmSetup'
import { useEffect, useId, useRef, useState } from 'react'
import { vmMinecraftServerTypes, vmOperatingSystems, vmResourceOptions, vmServiceGroups, vmServices } from '@/utils/vms/createOptions'
import type { NotifyVmAction } from '@/components/vms/vmActionFeedback'
import VmOperatingSystemPicker from './vmOperatingSystemPicker'

const starterWebsitePlan: VmWebsitePlan = {
    title: 'Make this space yours.',
    tagline: 'A simple one-page website, ready for your content.',
    sections: [],
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
    const [websitePlan, setWebsitePlan] = useState<VmWebsitePlan>(starterWebsitePlan)
    const [suggestingSetup, setSuggestingSetup] = useState(false)
    const [creating, setCreating] = useState(false)
    const [creationError, setCreationError] = useState('')
    const requiresFourGiB = selectedServices.includes('minecraft-java') || operatingSystem === 'ubuntu-24.04-desktop'
    const availableResources = vmResourceOptions.filter(option => !requiresFourGiB || option.memory !== '2GiB')

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
        } catch (error) {
            setSetupSuggestion(error instanceof Error ? error.message : 'Unable to suggest a VM setup.')
        } finally { setSuggestingSetup(false) }
    }

    return <form id={id} onSubmit={create} className={visible ? 'grid gap-4 rounded-xl border border-ui-border bg-ui-canvas/50 p-4' : 'hidden'}>
        <div className='grid gap-2 rounded-lg border border-ui-border bg-ui-panel p-3'>
            <label htmlFor={promptId} className='text-sm font-medium text-ui-text'>Describe what you want to build</label>
            <div className='flex flex-wrap items-center gap-2'>
                <input id={promptId} value={setupPrompt} onChange={event => { setSetupPrompt(event.target.value); setSelectedServices([]); setMinecraftEulaAccepted(false); setWebsitePlan(starterWebsitePlan); setCustomAptPackages([]); setSetupSuggestion('') }} maxLength={1200} placeholder='A portfolio for a ceramic artist, or Node.js with PostgreSQL' disabled={creating || suggestingSetup} className='h-10 min-w-0 flex-1 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text placeholder:text-ui-muted' />
                <button type='button' onClick={suggestSetup} disabled={creating || suggestingSetup || setupPrompt.trim().length < 5} className='h-10 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-medium text-ui-text hover:bg-ui-panel disabled:opacity-50'>{suggestingSetup ? 'Creating…' : 'Generate setup'}</button>
            </div>
            {setupSuggestion && <p role='status' className='text-sm text-ui-muted'>{setupSuggestion}</p>}
            {customAptPackages.length > 0 && <p className='text-xs text-ui-muted'>Additional Ubuntu packages: {customAptPackages.join(', ')}</p>}
        </div>
        <div className='grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3'>
            <label className='grid min-w-0 gap-1 text-sm text-ui-muted'>VM name<input ref={nameInput} value={name} onChange={event => setName(event.target.value)} required pattern='[a-z][a-z0-9-]{0,61}[a-z0-9]' minLength={2} maxLength={63} title='2–63 lowercase letters, numbers or hyphens, starting with a letter' disabled={creating} className='h-10 w-full min-w-0 rounded-lg border border-ui-border bg-ui-raised px-3 text-ui-text' /></label>
            <VmOperatingSystemPicker value={operatingSystem} onChange={value => {
                setOperatingSystem(value)
                if (value === 'ubuntu-24.04-desktop' && resourcePlan === 'small') setResourcePlan('standard')
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
        {selectedServices.includes('website') && <fieldset disabled={creating} className='grid min-w-0 gap-3 rounded-xl border border-ui-border bg-ui-panel p-3 sm:p-4'>
            <legend className='px-1 text-sm font-semibold text-ui-text'>Website draft</legend>
            <div className='grid min-w-0 gap-4 xl:grid-cols-2'>
                <div className='grid min-w-0 content-start gap-3'>
                    <label className='grid gap-1 text-xs font-medium text-ui-muted'>Page title<input required maxLength={120} value={websitePlan.title} onChange={event => setWebsitePlan(current => ({ ...current, title: event.target.value }))} className='h-10 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-normal text-ui-text outline-none focus-visible:ring-2 focus-visible:ring-ui-primary/20' /></label>
                    <label className='grid gap-1 text-xs font-medium text-ui-muted'>Short introduction<textarea maxLength={120} rows={2} value={websitePlan.tagline} onChange={event => setWebsitePlan(current => ({ ...current, tagline: event.target.value }))} className='resize-y rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm font-normal text-ui-text outline-none focus-visible:ring-2 focus-visible:ring-ui-primary/20' /></label>
                    {websitePlan.sections.map((section, index) => <fieldset key={index} className='grid min-w-0 gap-2 rounded-lg border border-ui-border p-3'>
                        <legend className='px-1 text-xs font-medium text-ui-muted'>Section {index + 1}</legend>
                        <label className='grid gap-1 text-xs font-medium text-ui-muted'>Heading<input maxLength={100} value={section.heading} onChange={event => setWebsitePlan(current => ({ ...current, sections: current.sections.map((item, itemIndex) => itemIndex === index ? { ...item, heading: event.target.value } : item) }))} className='h-10 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-normal text-ui-text outline-none focus-visible:ring-2 focus-visible:ring-ui-primary/20' /></label>
                        <label className='grid gap-1 text-xs font-medium text-ui-muted'>Text<textarea maxLength={500} rows={3} value={section.body} onChange={event => setWebsitePlan(current => ({ ...current, sections: current.sections.map((item, itemIndex) => itemIndex === index ? { ...item, body: event.target.value } : item) }))} className='resize-y rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm font-normal text-ui-text outline-none focus-visible:ring-2 focus-visible:ring-ui-primary/20' /></label>
                        <button type='button' onClick={() => setWebsitePlan(current => ({ ...current, sections: current.sections.filter((_, itemIndex) => itemIndex !== index) }))} className='justify-self-start rounded-md px-2 py-1 text-xs font-medium text-ui-muted hover:bg-ui-raised hover:text-ui-text'>Remove section</button>
                    </fieldset>)}
                    <button type='button' disabled={websitePlan.sections.length >= 5} onClick={() => setWebsitePlan(current => ({ ...current, sections: [...current.sections, { heading: '', body: '' }] }))} className='h-9 justify-self-start rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-medium text-ui-text hover:bg-ui-panel disabled:opacity-50'>Add section</button>
                    <p className='text-xs text-ui-muted'>This creates a simple static page. You can review the page before creating the VM.</p>
                </div>
                <section aria-label='Website preview' className='min-w-0 overflow-hidden rounded-xl border border-ui-border bg-[#f7f5f0] p-3 text-[#20241f] sm:p-5'>
                    <div className='mx-auto grid min-h-48 max-w-xl content-start gap-3 rounded-xl bg-[#e9e6dc] p-5 sm:p-7'>
                        <p className='text-[10px] font-semibold uppercase tracking-[0.16em] text-[#62685f]'>Preview</p>
                        <h2 className='wrap-break-word text-3xl font-semibold leading-tight tracking-tight sm:text-4xl'>{websitePlan.title || 'Your page title'}</h2>
                        {websitePlan.tagline && <p className='whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-[#555c56]'>{websitePlan.tagline}</p>}
                    </div>
                    <div className='mx-auto grid max-w-xl'>
                        {websitePlan.sections.length ? websitePlan.sections.map((section, index) => <article key={index} className='grid gap-1 border-b border-[#d8d7cf] px-1 py-4'>
                            <h3 className='wrap-break-word text-base font-semibold'>{section.heading || 'Section heading'}</h3>
                            {section.body && <p className='whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-[#555c56]'>{section.body}</p>}
                        </article>) : <p className='px-1 py-4 text-sm text-[#62685f]'>Add a section to build out your page.</p>}
                    </div>
                </section>
            </div>
        </fieldset>}
        {selectedServices.includes('minecraft-java') && <label className='grid gap-1 text-sm text-ui-muted'>Server software<select value={minecraftServerType} onChange={event => setMinecraftServerType(event.target.value as typeof vmMinecraftServerTypes[number]['id'])} disabled={creating} className='h-10 max-w-sm rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none focus-visible:ring-2 focus-visible:ring-ui-primary/20'>{vmMinecraftServerTypes.map(type => <option key={type.id} value={type.id}>{type.label} · {type.description}</option>)}</select></label>}
        {!canCreate && <p role='status' className='rounded-lg border border-ui-border bg-ui-panel px-3 py-2.5 text-sm leading-5 text-ui-muted'>{permissionMessage}</p>}
        <button disabled={creating || !canCreate} className='h-10 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary disabled:opacity-50'>{creating ? 'Creating VM…' : 'Create VM'}</button>
        {creationError && <p role='alert' className='rounded-lg border border-ui-danger/25 bg-ui-danger/5 px-3 py-2.5 text-sm leading-5 text-ui-danger'>{creationError}</p>}
    </form>
}
