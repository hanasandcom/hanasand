export function scopeVmInventory(vms: VM[], organizationId?: string | null): VM[] {
    const activeOrganizationId = organizationId || null
    return vms.filter(vm => (vm.organization_id || null) === activeOrganizationId)
}
