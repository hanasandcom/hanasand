import { expect, test } from 'bun:test'
import { supportedVmHostPath } from '../src/utils/vms/hostTransport.ts'

test('host transport permits existing VM calls and the dedicated internal provisioning route', () => {
    expect(supportedVmHostPath('/vm/remote-vm/start')).toBe(true)
    expect(supportedVmHostPath('/vm/remote-vm/recovery')).toBe(true)
    expect(supportedVmHostPath('/vms/internal/remote-vm/provision')).toBe(true)
})

test('host transport rejects paths outside its VM route allowlist', () => {
    expect(supportedVmHostPath('/management/users')).toBe(false)
    expect(supportedVmHostPath('/vms/internal/../admin/provision')).toBe(false)
    expect(supportedVmHostPath('/vms/internal/a%2Fadmin/provision')).toBe(false)
    expect(supportedVmHostPath('/vms/internal/remote-vm/delete')).toBe(false)
})
