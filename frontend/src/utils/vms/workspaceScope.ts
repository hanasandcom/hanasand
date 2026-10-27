export function scopeVmInventory(vms: VM[], organizationId?: string | null): VM[] {
    const activeOrganizationId = organizationId || null
    // Only explicitly personal records belong in Personal. Treating a missing
    // organization_id as null can leak organization-owned records from older
    // or incomplete API responses into the personal inventory.
    return vms.filter(vm => activeOrganizationId === null
        ? vm.organization_id === null
        : vm.organization_id === activeOrganizationId)
}
