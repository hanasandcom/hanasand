import { expect, test } from 'bun:test'
import { localProvisionFailureReason } from '../src/utils/vms/localProvisionState.ts'

test('local VM setup errors explain exhausted resource quotas without exposing host details', () => {
    expect(localProvisionFailureReason(new Error('Reached maximum aggregate value "40GiB" for "limits.disk" in project "hns-stage"')))
        .toContain('remaining disk quota')
    expect(localProvisionFailureReason(new Error('Reached maximum aggregate value "8GiB" for "limits.memory" in project "hns-stage"')))
        .toContain('memory allocation')
    expect(localProvisionFailureReason(new Error('Reached maximum aggregate value "4" for "limits.cpu" in project "hns-stage"')))
        .toContain('CPU allocation')
    expect(localProvisionFailureReason(new Error('Reached maximum aggregate value "2" for "limits.virtual-machines" in project "hns-stage"')))
        .toContain('no available VM capacity')
    expect(localProvisionFailureReason(new Error('LXD image unavailable')))
        .toBe('VM setup could not start. Try again or contact Support if the problem persists.')
})
