'use client'

import { vmMinecraftAddons, type VmMinecraftServerType } from '@/utils/vms/createOptions'

export default function VmMinecraftAddonPicker({ serverType, value, onChange, disabled }: {
    serverType: VmMinecraftServerType
    value: string[]
    onChange: (addons: string[]) => void
    disabled: boolean
}) {
    const addonKey = serverType === 'PURPUR' ? 'PAPER'
        : serverType === 'QUILT' ? 'FABRIC'
            : serverType === 'NEOFORGE' ? 'FORGE' : serverType
    if (!['PAPER', 'PURPUR', 'FABRIC', 'QUILT', 'FORGE', 'NEOFORGE'].includes(serverType)) return null
    const title = ['PAPER', 'PURPUR'].includes(serverType) ? 'Popular plugins' : 'Popular mods'

    return <fieldset disabled={disabled} className='grid gap-2 rounded-lg border border-ui-border bg-ui-panel p-3'>
        <legend className='px-1 text-sm font-medium text-ui-text'>{title}</legend>
        <p className='text-xs text-ui-muted'>Matched to the latest Minecraft release when the server is installed.</p>
        <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-3'>
            {vmMinecraftAddons[addonKey as keyof typeof vmMinecraftAddons].map(addon => <label key={addon.id} className='flex cursor-pointer items-start gap-2 rounded-lg border border-ui-border bg-ui-canvas px-3 py-2.5'>
                <input type='checkbox' checked={value.includes(addon.id)} onChange={event => onChange(event.target.checked ? [...value, addon.id] : value.filter(id => id !== addon.id))} className='mt-1 accent-ui-primary' />
                <span className='grid'><span className='text-sm font-medium text-ui-text'>{addon.label}</span><span className='text-xs text-ui-muted'>{addon.description}</span></span>
            </label>)}
        </div>
    </fieldset>
}
