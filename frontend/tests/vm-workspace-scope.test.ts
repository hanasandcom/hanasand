import { expect, test } from 'bun:test'
import { scopeVmInventory } from '../src/utils/vms/workspaceScope'

const vm = (name: string, organization_id: string | null): VM => ({
    name,
    organization_id,
} as VM)

test('personal VM inventory hides organization-owned records', () => {
    expect(scopeVmInventory([
        vm('personal', null),
        vm('cashflow', 'cashflow'),
        vm('research', 'research'),
    ])).toEqual([vm('personal', null)])
})

test('organization VM inventory includes only the selected organization', () => {
    expect(scopeVmInventory([
        vm('personal', null),
        vm('cashflow', 'cashflow'),
        vm('research', 'research'),
    ], 'cashflow')).toEqual([vm('cashflow', 'cashflow')])
})
