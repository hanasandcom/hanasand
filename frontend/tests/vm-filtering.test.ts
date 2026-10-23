import { strict as assert } from 'node:assert'
import test from 'node:test'
import { defaultVmFilters, filterVms } from '../src/utils/vms/filterVms'

const vms = [
    { name: 'api-prod', status: 'RUNNING', limits_cpu: '4', limits_memory: '4GiB', access_users: ['mira', 'jo'] },
    { name: 'docs-preview', status: 'stopped', limits_cpu: '1', limits_memory: '1024MB', access_users: [] },
    { name: 'old-worker', status: 'stopped', limits_cpu: '2', limits_memory: '8GB', access_users: ['jo'], deleted_at: '2026-10-18T10:00:00Z' },
] as unknown as VM[]

test('VM filters combine name, CPU, memory, exact editor, deletion and power state', () => {
    assert.deepEqual(filterVms(vms, { ...defaultVmFilters, name: 'PROD', cpu: '4' }).map(vm => vm.name), ['api-prod'])
    assert.deepEqual(filterVms(vms, { ...defaultVmFilters, memory: '4', editors: 'jo' }).map(vm => vm.name), ['api-prod', 'old-worker'])
    assert.deepEqual(filterVms(vms, { ...defaultVmFilters, lifecycle: 'scheduled' }).map(vm => vm.name), ['old-worker'])
    assert.deepEqual(filterVms(vms, { ...defaultVmFilters, status: 'running' }).map(vm => vm.name), ['api-prod'])
})

test('VM filters treat missing and malformed resource values as below selected minimums', () => {
    const incomplete = [{ name: 'pending', limits_cpu: '', limits_memory: 'unknown', access_users: [] }] as unknown as VM[]
    assert.deepEqual(filterVms(incomplete, { ...defaultVmFilters, cpu: '1' }), [])
    assert.deepEqual(filterVms(incomplete, { ...defaultVmFilters, memory: '1' }), [])
    assert.deepEqual(filterVms(incomplete, { ...defaultVmFilters, name: ' ' }), incomplete)
})

test('VM disk resource filters use latest accessible disk totals and exclude missing metrics', () => {
    const diskTotalsMb = new Map<string, number | null>([
        ['api-prod', 40 * 1024],
        ['docs-preview', 20 * 1024],
        ['old-worker', null],
    ])

    assert.deepEqual(filterVms(vms, { ...defaultVmFilters, disk: '20' }, diskTotalsMb).map(vm => vm.name), ['api-prod', 'docs-preview'])
    assert.deepEqual(filterVms(vms, { ...defaultVmFilters, disk: '40' }, diskTotalsMb).map(vm => vm.name), ['api-prod'])
    assert.deepEqual(filterVms(vms, { ...defaultVmFilters, disk: '20' }, new Map([['api-prod', 40 * 1024], ['docs-preview', Number.NaN]])).map(vm => vm.name), ['api-prod'])
    assert.deepEqual(filterVms(vms, { ...defaultVmFilters, disk: '10' }).map(vm => vm.name), [])
})
