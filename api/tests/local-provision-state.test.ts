import { expect, test } from 'bun:test'
import { localProvisionFailureReason } from '../src/utils/vms/localProvisionState.ts'

test('local VM provisioning explains a host quota failure without exposing arbitrary errors', () => {
    expect(localProvisionFailureReason(new Error('Project hns-stage exceeds limits.virtual-machines')))
        .toContain('no available VM capacity')
    expect(localProvisionFailureReason(new Error('LXD failed with token=private')))
        .toBe('VM setup could not start. Try again or contact Support if the problem persists.')
})
