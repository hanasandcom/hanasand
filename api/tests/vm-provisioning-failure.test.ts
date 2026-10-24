import { expect, test } from 'bun:test'
import { publicVmProvisioningFailureReason } from '../src/utils/vms/provisioningFailure.ts'

test('VM disk quota failures give a safe, actionable creation error', () => {
    expect(publicVmProvisioningFailureReason(new Error('Failed checking if instance creation allowed: Reached maximum aggregate value "40GiB" for "limits.disk" in project "hns-stage"')))
        .toBe('There is not enough disk capacity on the VM host for this plan. Choose a smaller disk or contact Support.')
})

test('VM CPU and memory quota failures give an actionable creation error', () => {
    expect(publicVmProvisioningFailureReason(new Error('Reached maximum aggregate value "8GiB" for "limits.memory" in project "hns-stage"')))
        .toBe('The VM host does not have enough CPU or memory capacity for this plan. Choose fewer resources or contact Support.')
})

test('VM instance quota failures give an actionable creation error', () => {
    expect(publicVmProvisioningFailureReason(new Error('Reached maximum aggregate value "2" for "limits.instances" in project "hns-stage"')))
        .toBe('The VM host has reached its VM limit. Remove an unused VM or contact Support.')
})

test('unrecognized provisioning errors hide host details behind the generic recovery message', () => {
    expect(publicVmProvisioningFailureReason(new Error('private host path /run/lxd/unix.socket failed')))
        .toBe('VM setup could not start. Try again or contact Support if the problem persists.')
    expect(publicVmProvisioningFailureReason('unavailable'))
        .toBe('VM setup could not start. Try again or contact Support if the problem persists.')
})
