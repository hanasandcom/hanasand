import type { FormEvent, Dispatch, SetStateAction } from 'react'
import type { NotifyVmAction } from '@/components/vms/vmActionFeedback'
import postVM from '@/utils/vms/fetch/postVM'
import type { VmWebsitePlan } from '@/utils/vms/fetch/suggestVmSetup'
import type { VmMinecraftServerType } from '@/utils/vms/createOptions'
import type { getVmResourceAllocation } from '@/utils/vms/resourceAllocation'

export async function submitVmCreation(event: FormEvent, input: {
    canCreate: boolean
    permissionMessage: string
    resourceError: string
    notify: NotifyVmAction
    onCreating: (creating: boolean) => void
    onCreated: (vm: VM | undefined, name: string) => void
    name: string
    operatingSystem: string
    resources: ReturnType<typeof getVmResourceAllocation>
    selectedServices: string[]
    customAptPackages: string[]
    minecraftServerType: VmMinecraftServerType
    minecraftAddons: string[]
    websitePlan: VmWebsitePlan
    projectFiles: Array<{ path: string, content: string }>
    organizationId: string | null
    setCreationError: Dispatch<SetStateAction<string>>
    setCreating: Dispatch<SetStateAction<boolean>>
    reset: () => void
}) {
    event.preventDefault()
    input.setCreationError('')
    if (!input.canCreate) {
        const message = input.permissionMessage || 'An organization owner or admin must create VMs.'
        input.setCreationError(message)
        input.notify(message, 'error', 'vm-create')
        return
    }
    if (input.resourceError) {
        input.setCreationError(input.resourceError)
        return
    }
    input.setCreating(true)
    input.onCreating(true)
    input.notify('Creating virtual machine…', 'progress', 'vm-create')
    try {
        const vmName = input.name.trim()
        const result = await postVM({
            name: vmName, os: input.operatingSystem, resources: input.resources,
            services: input.selectedServices, custom_apt_packages: input.customAptPackages,
            minecraft_eula_accepted: input.selectedServices.includes('minecraft-java'),
            minecraft_server_type: input.selectedServices.includes('minecraft-java') ? input.minecraftServerType : undefined,
            minecraft_addons: input.minecraftAddons,
            website: input.selectedServices.includes('website') ? input.websitePlan : null,
            project_files: input.projectFiles.length ? input.projectFiles : undefined,
            organization_id: input.organizationId || null,
        })
        if (result.status !== 201) {
            input.setCreationError(result.message)
            input.notify(result.message, 'error', 'vm-create')
            return
        }
        input.notify(`${vmName} is queued. Follow setup in its terminal.`, 'success', 'vm-create')
        input.reset()
        input.onCreated(result.vm, vmName)
    } catch {
        input.setCreationError('Unable to create the virtual machine. Please try again.')
        input.notify('Unable to create the virtual machine. Please try again.', 'error', 'vm-create')
    } finally {
        input.setCreating(false)
        input.onCreating(false)
    }
}
