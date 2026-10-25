import { expect, test } from 'bun:test'
import { getVmResourceAllocation, getVmResourceError } from '../src/utils/vms/resourceAllocation'

test('resource presets forward their configured CPU, memory, and disk values', () => {
    expect(getVmResourceAllocation('small', '2', '4')).toMatchObject({ cpu: '1', memory: '2GiB', disk: '10GiB' })
    expect(getVmResourceAllocation('standard', '2', '4')).toMatchObject({ cpu: '2', memory: '4GiB', disk: '20GiB' })
    expect(getVmResourceAllocation('large', '2', '4')).toMatchObject({ cpu: '4', memory: '8GiB', disk: '40GiB' })
})

test('custom resources support valid values through the requested maximum', () => {
    expect(getVmResourceAllocation('custom', '10', '64', '100')).toEqual({ cpu: '10', memory: '64GiB', disk: '100GiB' })
    expect(getVmResourceAllocation('custom', '2', '4', '20')).toEqual({ cpu: '2', memory: '4GiB', disk: '20GiB' })
    expect(getVmResourceError('custom', '1', '1', '20', 1, 20)).toBe('')
    expect(getVmResourceError('custom', '3', '16', '40', 4, 20)).toBe('')
    expect(getVmResourceError('custom', '10', '64', '100', 8, 40)).toBe('')
})

test('custom resources reject values outside limits and allocations too small for the selected setup', () => {
    expect(getVmResourceError('custom', '0', '4', '40', 1, 20)).not.toBe('')
    expect(getVmResourceError('custom', '11', '4', '40', 1, 20)).not.toBe('')
    expect(getVmResourceError('custom', '2', '0', '40', 1, 20)).not.toBe('')
    expect(getVmResourceError('custom', '2', '65', '40', 1, 20)).not.toBe('')
    expect(getVmResourceError('custom', '2', '4', '19', 1, 20)).not.toBe('')
    expect(getVmResourceError('custom', '2', '4', '101', 1, 20)).not.toBe('')
    expect(getVmResourceError('custom', '2', '4', '20', 8, 20)).toContain('at least 8 GB')
    expect(getVmResourceError('custom', '2', '4', '20', 1, 40)).toContain('at least 40 GB of disk')
})
