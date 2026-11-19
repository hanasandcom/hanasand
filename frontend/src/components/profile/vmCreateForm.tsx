'use client'

import suggestVmSetup, { type VmWebsitePlan } from '@/utils/vms/fetch/suggestVmSetup'
import { useEffect, useId, useRef, useState } from 'react'
import { isVmGameServer, vmGameServers, vmMinecraftServerTypes, vmOperatingSystems, vmResourceOptions, vmServiceTabs, vmServices } from '@/utils/vms/createOptions'
import type { NotifyVmAction } from '@/components/vms/vmActionFeedback'
import VmOperatingSystemPicker from './vmOperatingSystemPicker'
import VmResourcePicker from './vmResourcePicker'
import VmCustomResourceFields from './vmCustomResourceFields'
import VmMinecraftAddonPicker from './vmMinecraftAddonPicker'
import VmMinecraftServerPicker from './vmMinecraftServerPicker'
import VmGameServerDetails from './vmGameServerDetails'
import VmWebsiteEditor from './vmWebsiteEditor'
import { getVmResourceAllocation, getVmResourceError } from '@/utils/vms/resourceAllocation'
import { fitVmGameResources } from '@/utils/vms/gameResourceSelection'
import { starterWebsitePlan } from '@/utils/vms/websiteStarter'
import { submitVmCreation } from './vmCreateSubmission'
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
    const serviceTabRefs = useRef<Array<HTMLButtonElement | null>>([])
    const promptId = useId()
    const [name, setName] = useState('')
    const [operatingSystem, setOperatingSystem] = useState<string>(vmOperatingSystems[0].id)
    const [resourcePlan, setResourcePlan] = useState<string>(vmResourceOptions[0].id)
    const [customCpu, setCustomCpu] = useState('2')
    const [customMemory, setCustomMemory] = useState('4')
    const [customDisk, setCustomDisk] = useState('40')
    const [selectedServices, setSelectedServices] = useState<string[]>([])
    const [activeServiceTab, setActiveServiceTab] = useState<(typeof vmServiceTabs)[number]['id']>('development')
    const [customAptPackages, setCustomAptPackages] = useState<string[]>([])
    const [minecraftServerType, setMinecraftServerType] = useState<typeof vmMinecraftServerTypes[number]['id']>('PAPER')
    const [minecraftAddons, setMinecraftAddons] = useState<string[]>([])
    const [setupPrompt, setSetupPrompt] = useState('')
    const [setupSuggestion, setSetupSuggestion] = useState('')
    const [suggestedSetupKey, setSuggestedSetupKey] = useState('')
    const [websitePlan, setWebsitePlan] = useState<VmWebsitePlan>(starterWebsitePlan)
    const [projectFiles, setProjectFiles] = useState<Array<{ path: string, content: string }>>([])
    const [suggestingSetup, setSuggestingSetup] = useState(false)
    const [creating, setCreating] = useState(false)
    const [creationError, setCreationError] = useState('')
    const requiresLargePlan = operatingSystem === 'ubuntu-24.04-desktop'
    const requiresKaliDisk = operatingSystem === 'kali'
    const requiresFourGiB = projectFiles.length > 0 || (selectedServices.includes('minecraft-java') && ['FABRIC', 'QUILT', 'FORGE', 'NEOFORGE', 'FOLIA'].includes(minecraftServerType))
    const selectedGame = vmGameServers.find(game => selectedServices.includes(game.id))
    const minimumMemory = Math.max(requiresLargePlan ? 8 : 1, requiresFourGiB ? 4 : 1, selectedGame?.minMemoryGiB || 1)
    const minimumDisk = Math.max(requiresLargePlan ? 40 : requiresKaliDisk ? 30 : 20, selectedGame?.minDiskGiB || 20)
    const availableResources = vmResourceOptions.filter(option => option.id === 'custom' || (
        (!requiresLargePlan && !requiresKaliDisk || option.id === 'large')
        && Number.parseInt(option.memory, 10) >= minimumMemory
        && Number.parseInt(option.disk, 10) >= (selectedGame?.minDiskGiB || (requiresLargePlan || requiresKaliDisk ? minimumDisk : 0))))
    const currentResources = getVmResourceAllocation(resourcePlan, customCpu, customMemory, customDisk)
    const resourceError = getVmResourceError(resourcePlan, customCpu, customMemory, customDisk, minimumMemory, minimumDisk)
        || (selectedGame && (Number.parseInt(currentResources.memory, 10) < minimumMemory || Number.parseInt(currentResources.disk, 10) < minimumDisk)
            ? `${selectedGame.label} needs at least ${minimumMemory} GB of memory and ${minimumDisk} GB of disk.` : '')
    const currentSetupKey = `${operatingSystem}\n${setupPrompt.trim()}`
    const unresolvedSetupPrompt = setupPrompt.trim().length >= 3 && suggestedSetupKey !== currentSetupKey
        && selectedServices.length === 0 && customAptPackages.length === 0

    useEffect(() => { if (visible) nameInput.current?.focus() }, [visible])

    function fitGameResources(gameId: string) {
        const game = vmGameServers.find(option => option.id === gameId)
        if (!game) return
        const fitted = fitVmGameResources(game, resourcePlan, customMemory, customDisk)
        setCustomMemory(fitted.memory)
        setCustomDisk(fitted.disk)
        setResourcePlan(fitted.plan)
    }

    function create(event: React.FormEvent) {
        return submitVmCreation(event, {
            canCreate, permissionMessage, resourceError, notify, onCreating, onCreated,
            name, operatingSystem, resources: currentResources, selectedServices, customAptPackages,
            minecraftServerType, minecraftAddons, websitePlan, projectFiles, organizationId,
            setCreationError, setCreating,
            reset: () => {
                setName(''); setSelectedServices([]); setCustomAptPackages([])
                setMinecraftServerType('PAPER'); setMinecraftAddons([]); setSetupPrompt('')
                setSetupSuggestion(''); setWebsitePlan(starterWebsitePlan); setProjectFiles([])
                setSuggestedSetupKey('')
            },
        })
    }

    async function suggestSetup() {
        setSuggestingSetup(true)
        setSetupSuggestion('')
        try {
            const plan = await suggestVmSetup(setupPrompt, operatingSystem)
            const plannedGame = plan.services.find(isVmGameServer)
            const safeServices = operatingSystem === 'fedora-44' ? plan.services.filter(service => service !== 'nginx' && service !== 'website') : plan.services
            setSelectedServices(plannedGame ? safeServices.filter(service => !isVmGameServer(service) || service === plannedGame) : safeServices)
            if (plannedGame && plannedGame !== 'minecraft-java') fitGameResources(plannedGame)
            if (plan.services.includes('minecraft-java') && plan.minecraftServerType && ['FABRIC', 'QUILT', 'FORGE', 'NEOFORGE', 'FOLIA'].includes(plan.minecraftServerType) && resourcePlan === 'small') setResourcePlan('standard')
            setMinecraftAddons([])
            setCustomAptPackages(plan.aptPackages)
            setSetupSuggestion(operatingSystem === 'fedora-44' && safeServices.length !== plan.services.length ? `${plan.summary} Nginx and Website were omitted because Fedora 44 does not yet have a fixed Nginx package.` : plan.summary)
            setWebsitePlan(plan.website || starterWebsitePlan)
            setProjectFiles(plan.projectFiles || [])
            if (plan.projectFiles?.length && resourcePlan === 'small') setResourcePlan('standard')
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
                <input id={promptId} value={setupPrompt} onChange={event => { setSetupPrompt(event.target.value); setSelectedServices([]); setWebsitePlan(starterWebsitePlan); setProjectFiles([]); setCustomAptPackages([]); setSetupSuggestion(''); setSuggestedSetupKey('') }} maxLength={1200} placeholder='A portfolio, a custom app, or Node.js with PostgreSQL' disabled={creating || suggestingSetup} className='h-10 min-w-0 flex-1 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text placeholder:text-ui-muted' />
                <button type='button' onClick={suggestSetup} disabled={creating || suggestingSetup || setupPrompt.trim().length < 3} className='h-10 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-medium text-ui-text hover:bg-ui-panel disabled:opacity-50'>{suggestingSetup ? 'Creating…' : 'Generate setup'}</button>
            </div>
            {setupSuggestion && <p role='status' className='text-sm text-ui-muted'>{setupSuggestion}</p>}
            {customAptPackages.length > 0 && <p className='text-xs text-ui-muted'>Additional Ubuntu packages: {customAptPackages.join(', ')}</p>}
        </div>
        <div className='grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3'>
            <label className='grid min-w-0 gap-1 text-sm text-ui-muted'>VM name<input ref={nameInput} value={name} onChange={event => setName(event.target.value)} required pattern='[a-z][a-z0-9-]{0,61}[a-z0-9]' minLength={2} maxLength={63} title='2–63 lowercase letters, numbers or hyphens, starting with a letter' disabled={creating} className='h-10 w-full min-w-0 rounded-lg border border-ui-border bg-ui-raised px-3 text-ui-text' /></label>
            <VmOperatingSystemPicker value={operatingSystem} onChange={value => {
                setOperatingSystem(value)
                if (value === 'fedora-44') setSelectedServices(current => current.filter(service => service !== 'nginx' && service !== 'website'))
                if (value !== 'ubuntu-24.04' && selectedServices.some(service => service.startsWith('game-'))) {
                    setSelectedServices(current => current.filter(service => !service.startsWith('game-')))
                    setSetupSuggestion('Dedicated game servers currently require Ubuntu 24.04. Choose the game again after switching back.')
                }
                if (setupPrompt.trim()) {
                    setSelectedServices([])
                    setMinecraftServerType('PAPER')
                    setWebsitePlan(starterWebsitePlan)
                    setProjectFiles([])
                }
                setCustomAptPackages([])
                setSuggestedSetupKey('')
                if (setupPrompt.trim()) setSetupSuggestion('The operating system changed. Generate the setup again to check package compatibility.')
                if ((value === 'ubuntu-24.04-desktop' || value === 'kali') && resourcePlan !== 'custom') setResourcePlan('large')
            }} disabled={creating} />
            <VmResourcePicker value={resourcePlan} onChange={setResourcePlan} disabled={creating} availableOptions={availableResources} />
        </div>
        {resourcePlan === 'custom' && <VmCustomResourceFields cpu={customCpu} memory={customMemory} disk={customDisk} minimumMemory={minimumMemory} minimumDisk={minimumDisk} disabled={creating} onCpuChange={setCustomCpu} onMemoryChange={setCustomMemory} onDiskChange={setCustomDisk} />}
        {operatingSystem === 'ubuntu-24.04-desktop' && <p className='rounded-lg border border-ui-border bg-ui-panel px-3 py-2.5 text-xs leading-5 text-ui-muted'>After creation, open the VM's Access panel and use its SSH details with <code className='rounded bg-ui-raised px-1 py-0.5 text-ui-text'>-N -L 3389:127.0.0.1:3389</code> added. Then open Remote Desktop at <code className='rounded bg-ui-raised px-1 py-0.5 text-ui-text'>127.0.0.1:3389</code> and sign in with your VM username and password.</p>}
        <fieldset disabled={creating} className='grid gap-2'>
            <legend className='mb-1 text-sm font-medium text-ui-text'>Install services</legend>
            <div role='tablist' aria-label='Service categories' onKeyDown={event => {
                const currentIndex = vmServiceTabs.findIndex(tab => tab.id === activeServiceTab)
                const nextIndex = event.key === 'ArrowRight' ? (currentIndex + 1) % vmServiceTabs.length
                    : event.key === 'ArrowLeft' ? (currentIndex - 1 + vmServiceTabs.length) % vmServiceTabs.length
                        : event.key === 'Home' ? 0
                            : event.key === 'End' ? vmServiceTabs.length - 1 : -1
                if (nextIndex < 0) return
                event.preventDefault()
                setActiveServiceTab(vmServiceTabs[nextIndex].id)
                serviceTabRefs.current[nextIndex]?.focus()
            }} className='grid grid-cols-3 gap-1 rounded-lg border border-ui-border bg-ui-panel p-1'>
                {vmServiceTabs.map((tab, index) => <button key={tab.id} ref={element => { serviceTabRefs.current[index] = element }} type='button' role='tab' id={`${promptId}-service-tab-${tab.id}`} aria-selected={activeServiceTab === tab.id} aria-controls={`${promptId}-service-panel`} tabIndex={activeServiceTab === tab.id ? 0 : -1} onClick={() => setActiveServiceTab(tab.id)} className={`min-h-10 min-w-0 rounded-md px-1.5 text-xs font-medium leading-4 transition-colors sm:px-3 sm:text-sm ${activeServiceTab === tab.id ? 'bg-ui-raised text-ui-text shadow-sm' : 'text-ui-muted hover:bg-ui-raised/60 hover:text-ui-text'}`}>
                    {tab.label}
                </button>)}
            </div>
            <section role='tabpanel' id={`${promptId}-service-panel`} aria-labelledby={`${promptId}-service-tab-${activeServiceTab}`} tabIndex={0} className='grid min-w-0 gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ui-primary/20'>
                {vmServiceTabs.find(tab => tab.id === activeServiceTab)?.groups.map(group => <section key={group} aria-label={`${group} services`} className='grid gap-2'>
                    <h3 className='text-xs font-medium uppercase tracking-wide text-ui-muted'>{group}</h3>
                    <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-4'>
                        {vmServices.filter(service => service.group === group).map(service => <label key={service.id} className='flex cursor-pointer items-start gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 py-2.5'>
                            <input type='checkbox' checked={selectedServices.includes(service.id)} disabled={(operatingSystem === 'fedora-44' && ['nginx', 'website'].includes(service.id)) || (projectFiles.length > 0 && ['nodejs', 'website', 'minecraft-java'].includes(service.id)) || (projectFiles.length > 0 && isVmGameServer(service.id))} onChange={event => {
                                setSelectedServices(current => event.target.checked
                                    ? [...current.filter(id => !isVmGameServer(service.id) || !isVmGameServer(id)), service.id]
                                    : current.filter(id => id !== service.id))
                                if (service.id === 'minecraft-java' && event.target.checked && resourcePlan === 'small') setResourcePlan('standard')
                                if (service.id.startsWith('game-') && event.target.checked) {
                                    setOperatingSystem('ubuntu-24.04')
                                    fitGameResources(service.id)
                                }
                            }} className='mt-1 accent-ui-primary' />
                            <span className='grid'><span className='text-sm font-medium text-ui-text'>{service.label}</span><span className='text-xs text-ui-muted'>{operatingSystem === 'fedora-44' && ['nginx', 'website'].includes(service.id) ? 'Unavailable until Fedora provides a fixed Nginx package' : service.description}</span></span>
                        </label>)}
                    </div>
                </section>)}
            </section>
        </fieldset>
        {selectedServices.includes('website') && <VmWebsiteEditor plan={websitePlan} onChange={setWebsitePlan} disabled={creating} />}
        {selectedServices.includes('minecraft-java') && <>
            <VmMinecraftServerPicker value={minecraftServerType} onChange={type => { setMinecraftServerType(type); setMinecraftAddons([]); if (['FABRIC', 'QUILT', 'FORGE', 'NEOFORGE', 'FOLIA'].includes(type) && resourcePlan === 'small') setResourcePlan('standard') }} disabled={creating} />
            <VmMinecraftAddonPicker serverType={minecraftServerType} value={minecraftAddons} onChange={setMinecraftAddons} disabled={creating} />
        </>}
        {selectedGame && <VmGameServerDetails game={selectedGame} />}
        {!canCreate && permissionMessage && <p role='status' className='rounded-lg border border-ui-border bg-ui-panel px-3 py-2.5 text-sm leading-5 text-ui-muted'>{permissionMessage}</p>}
        {unresolvedSetupPrompt && <p role='status' className='text-xs leading-5 text-ui-muted'>Generate a supported setup for this description, or clear it to create a blank VM.</p>}
        <button disabled={creating || Boolean(permissionMessage) || unresolvedSetupPrompt} aria-disabled={!canCreate || undefined} className={`h-10 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary disabled:opacity-50 ${!canCreate ? 'cursor-not-allowed opacity-50' : ''}`}>{creating ? 'Creating VM…' : 'Create VM'}</button>
        {creationError && <p role='alert' className='rounded-lg border border-ui-danger/25 bg-ui-danger/5 px-3 py-2.5 text-sm leading-5 text-ui-danger'>{creationError}</p>}
    </form>}
