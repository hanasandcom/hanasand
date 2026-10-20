export type VmFilters = {
    name: string
    cpu: string
    memory: string
    editors: string
    lifecycle: string
    status: string
}

export const defaultVmFilters: VmFilters = { name: '', cpu: '', memory: '', editors: '', lifecycle: '', status: '' }

export function filterVms(vms: VM[], filters: VmFilters) {
    const name = filters.name.trim().toLocaleLowerCase()
    const cpu = Number(filters.cpu) || 0
    const memory = Number(filters.memory) || 0

    return vms.filter(vm => {
        if (name && !vm.name?.toLocaleLowerCase().includes(name)) return false
        if (cpu && (Number.parseFloat(vm.limits_cpu || '') || 0) < cpu) return false
        if (memory && memoryInGiB(vm.limits_memory) < memory) return false
        const hasEditors = Boolean(vm.access_users?.length)
        if (filters.editors === 'with' && !hasEditors) return false
        if (filters.editors === 'without' && hasEditors) return false
        if (filters.editors && !['with', 'without'].includes(filters.editors) && !vm.access_users?.includes(filters.editors)) return false
        const scheduled = Boolean(vm.deleted_at || vm.delete_after)
        if (filters.lifecycle === 'scheduled' && !scheduled) return false
        if (filters.lifecycle === 'active' && scheduled) return false
        const status = (vm.status || '').toLocaleLowerCase()
        if (filters.status === 'running' && !['running', 'frozen', 'starting'].includes(status)) return false
        if (filters.status === 'stopped' && !['stopped', 'shut off'].includes(status)) return false
        return true
    })
}

function memoryInGiB(value?: string | null) {
    const match = value?.trim().match(/^([\d.]+)\s*(B|KB|KIB|MB|MIB|GB|GIB|TB|TIB)?$/i)
    if (!match) return 0
    const amount = Number(match[1])
    const unit = (match[2] || 'GB').toUpperCase()
    if (!Number.isFinite(amount) || amount < 0) return 0
    const powers: Record<string, number> = { B: -30, KB: -20, KIB: -20, MB: -10, MIB: -10, GB: 0, GIB: 0, TB: 10, TIB: 10 }
    return amount * 2 ** (powers[unit] ?? 0)
}
