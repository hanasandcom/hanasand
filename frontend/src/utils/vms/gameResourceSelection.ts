import { vmResourceOptions, type VmGameServer } from './createOptions'

export function fitVmGameResources(game: VmGameServer, currentPlan: string, currentMemory: string, currentDisk: string) {
    const memory = String(Math.max(Number(currentMemory) || 0, game.minMemoryGiB))
    const disk = String(Math.max(Number(currentDisk) || 0, game.minDiskGiB))
    if (currentPlan === 'custom') return { plan: 'custom', memory, disk }
    const preset = vmResourceOptions.find(option => option.id !== 'custom'
        && Number.parseInt(option.memory, 10) >= game.minMemoryGiB
        && Number.parseInt(option.disk, 10) >= game.minDiskGiB)
    return { plan: preset?.id || 'custom', memory, disk }
}
