import { expect, test } from 'bun:test'
import { vmGameServers } from '../src/utils/vms/createOptions'
import { createdVmPublicServices, vmPublicServiceAddress, type VmPublicService } from '../src/utils/vms/fetch/publicServices'

const service = (type: VmPublicService['type'], publicPort?: number): VmPublicService => ({
    id: '1', name: 'survival', type, port: 27015, publicPort,
    hostname: 'survival.hanasand.com', createdAt: '2026-11-18T00:00:00Z',
})

test('public game routes show their allocated outside port while existing gateway routes stay on 443', () => {
    expect(vmPublicServiceAddress(service('udp', 32001), 'myvm.hanasand.com')).toBe('survival.hanasand.com:32001')
    expect(vmPublicServiceAddress(service('tcp', 32002), 'myvm.hanasand.com')).toBe('survival.hanasand.com:32002')
    expect(vmPublicServiceAddress(service('udp'), 'myvm.hanasand.com')).toBeNull()
    expect(vmPublicServiceAddress({ ...service('udp', 32001), hostname: null }, 'myvm.hanasand.com')).toBe('myvm.hanasand.com:32001')
    expect(vmPublicServiceAddress(service('minecraft-java'), 'myvm.hanasand.com')).toBe('survival.hanasand.com:443')
    expect(vmPublicServiceAddress(service('http'), 'myvm.hanasand.com')).toBe('survival.hanasand.com:443')
})

test('game presets retain all required protocol and guest-port pairs', () => {
    expect(vmGameServers.flatMap(game => game.ports)).toHaveLength(12)
    expect(vmGameServers.find(game => game.id === 'game-cs2')?.ports).toEqual([{ port: 27015, protocol: 'udp' }, { port: 27015, protocol: 'tcp' }])
    expect(vmGameServers.find(game => game.id === 'game-valheim')?.ports).toEqual([{ port: 2456, protocol: 'udp' }, { port: 2457, protocol: 'udp' }])
    expect(vmGameServers).toHaveLength(10)
})

test('a grouped game route response keeps every assigned public port', () => {
    const first = service('udp', 32000)
    const second = { ...service('udp', 32001), id: '2', name: 'survival-2', port: 2457 }
    expect(createdVmPublicServices({ services: [first, second] })).toEqual([first, second])
    expect(createdVmPublicServices(first)).toEqual([first])
})
