import type { OrganizationApiSmokeContext, Row } from './harness.ts'

export interface AlertAssertionContext {
    organization: Row
    assertOrganizationTenantIdentity: OrganizationApiSmokeContext['assertOrganizationTenantIdentity']
}

export type { Row } from './harness.ts'
