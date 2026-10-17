import { expect, test } from 'bun:test'
import { internalHostWebSocketTarget, supportedVmHostPath } from '../src/utils/vms/hostTransport.ts'

test('remote console keeps TLS on the service hostname while pinning the selected VM host', () => {
    const target = internalHostWebSocketTarget('ovhcloud', '/vms/internal/cashflow/console')
    expect(new URL(target.url).hostname).toBe('internal.hanasand.com')
    expect(target.address).toBe('192.99.32.185')
    expect(target.authorization.startsWith('Bearer ')).toBe(true)
})

test('remote console target rejects unknown hosts and unsafe paths', () => {
    expect(() => internalHostWebSocketTarget('unknown', '/vms/internal/cashflow/console')).toThrow('Unsupported container host websocket.')
    expect(() => internalHostWebSocketTarget('ovhcloud', '/vms/internal/../admin/console')).toThrow('Unsupported container host websocket.')
})

test('host transport permits existing VM calls and dedicated internal VM routes', () => {
    expect(supportedVmHostPath('/vm/remote-vm/start')).toBe(true)
    expect(supportedVmHostPath('/vm/remote-vm/recovery')).toBe(true)
    expect(supportedVmHostPath('/vms/internal/remote-vm/provision')).toBe(true)
    expect(supportedVmHostPath('/vms/internal/remote-vm/console')).toBe(true)
})

test('host transport rejects paths outside its VM route allowlist', () => {
    expect(supportedVmHostPath('/management/users')).toBe(false)
    expect(supportedVmHostPath('/vms/internal/../admin/provision')).toBe(false)
    expect(supportedVmHostPath('/vms/internal/a%2Fadmin/provision')).toBe(false)
    expect(supportedVmHostPath('/vms/internal/remote-vm/delete')).toBe(false)
    expect(supportedVmHostPath('/vms/internal/remote-vm/console/extra')).toBe(false)
    expect(supportedVmHostPath('/vms/internal/a%2Fadmin/console')).toBe(false)
})
