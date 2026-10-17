import { expect, mock, test } from 'bun:test'
import { internalHostAuthorizationCandidates, internalHostRequestHeaders, internalHostWebSocketTarget, pinnedHostLookup, supportedVmHostPath } from '../src/utils/vms/hostTransport.ts'

test('internal host auth preserves the current token and provides a distinct rotation-overlap fallback', () => {
    expect(internalHostAuthorizationCandidates('current token', 'previous token')).toEqual([
        'Bearer current%20token',
        'Bearer previous%20token',
    ])
    expect(internalHostAuthorizationCandidates('same token', 'same token')).toEqual(['Bearer same%20token'])
    expect(internalHostAuthorizationCandidates(undefined, 'previous token')).toEqual(['Bearer previous%20token'])
})

test('internal host requests include the OpenResty internal-route user agent', () => {
    expect(internalHostRequestHeaders({ 'Content-Type': 'application/json' }, 'Bearer token')).toEqual({
        'content-type': 'application/json',
        authorization: 'Bearer token',
        'user-agent': 'hanasand_internal',
    })
})

test('pinned host lookup supports single-address and all-address HTTPS lookup contracts', () => {
    const lookup = pinnedHostLookup('192.99.32.185')
    const single = mock((error: NodeJS.ErrnoException | null, address: string | Array<{ address: string; family: number }>, family?: number) => ({ error, address, family }))
    const all = mock((error: NodeJS.ErrnoException | null, addresses: string | Array<{ address: string; family: number }>, family?: number) => ({ error, addresses, family }))

    lookup('internal.hanasand.com', {}, single as never)
    lookup('internal.hanasand.com', { all: true }, all as never)

    expect(single.mock.calls[0]).toEqual([null, '192.99.32.185', 4])
    expect(all.mock.calls[0]).toEqual([null, [{ address: '192.99.32.185', family: 4 }]])
})

test('remote console keeps TLS on the service hostname while pinning the selected VM host', () => {
    const previousToken = process.env.VM_API_TOKEN_PREVIOUS
    let target: ReturnType<typeof internalHostWebSocketTarget>
    try {
        process.env.VM_API_TOKEN_PREVIOUS = 'shared rotation token'
        target = internalHostWebSocketTarget('ovhcloud', '/vms/internal/cashflow/console')
    } finally {
        if (previousToken === undefined) delete process.env.VM_API_TOKEN_PREVIOUS
        else process.env.VM_API_TOKEN_PREVIOUS = previousToken
    }

    expect(new URL(target.url).hostname).toBe('internal.hanasand.com')
    expect(target.address).toBe('192.99.32.185')
    expect(target.authorization).toBe('Bearer shared%20rotation%20token')
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
