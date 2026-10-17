export function organizationTenantIdentity<TOrganizationId, TTenantId>(organizationId: TOrganizationId, tenantId: TTenantId) {
    return { organizationId, tenantId }
}
