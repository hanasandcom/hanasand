import { expect, test } from 'bun:test'
import { getVmResourceAllocation, getVmResourceError } from '../src/utils/vms/resourceAllocation'

test('resource presets forward their configured CPU, memory, and disk values', () => {
    expect(getVmResourceAllocation('small', '2', '4')).toMatchObject({ cpu: '1', memory: '2GiB', disk: '10GiB' })
    expect(getVmResourceAllocation('standard', '2', '4')).toMatchObject({ cpu: '2', memory: '4GiB', disk: '20GiB' })
    expect(getVmResourceAllocation('large', '2', '4')).toMatchObject({ cpu: '4', memory: '8GiB', disk: '40GiB' })
})

test('custom resources support valid values through the requested maximum', () => {
    expect(getVmResourceAllocation('custom', '10', '64')).toEqual({ cpu: '10', memory: '64GiB', disk: '40GiB' })
    expect(getVmResourceError('custom', '1', '1', 1)).toBe('')
    expect(getVmResourceError('custom', '3', '16', 4)).toBe('')
    expect(getVmResourceError('custom', '10', '64', 8)).toBe('')
})

test('custom resources reject values outside limits and allocations too small for the selected setup', () => {
    expect(getVmResourceError('custom', '0', '4', 1)).not.toBe('')
    expect(getVmResourceError('custom', '11', '4', 1)).not.toBe('')
    expect(getVmResourceError('custom', '2', '0', 1)).not.toBe('')
    expect(getVmResourceError('custom', '2', '65', 1)).not.toBe('')
    expect(getVmResourceError('custom', '2', '4', 8)).toContain('at least 8 GB')
})
