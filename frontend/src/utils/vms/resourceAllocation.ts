import { vmResourceOptions } from './createOptions'

export function getVmResourceAllocation(plan: string, cpu: string, memory: string) {
    if (plan === 'custom') return { cpu, memory: `${memory}GiB`, disk: '40GiB' }
    const preset = vmResourceOptions.find(option => option.id === plan)
    return preset || vmResourceOptions[0]
}

export function getVmResourceError(plan: string, cpu: string, memory: string, minimumMemory: number) {
    if (plan !== 'custom') return ''
    if (!/^([1-9]|10)$/.test(cpu) || !/^([1-9]|[1-5][0-9]|6[0-4])$/.test(memory)) return 'Choose 1–10 vCPU and 1–64 GB of memory.'
    if (Number(memory) < minimumMemory) return `This setup needs at least ${minimumMemory} GB of memory.`
    return ''
}
