import { execFileSync } from 'node:child_process'
import { expect, test } from 'bun:test'
import { parse } from 'yaml'
import { gameServerCatalog, gameServerSetupScript, getGameServerDefinition, isGameServerService } from '../src/utils/vms/gameServers.ts'
import { vmSetupUserData } from '../src/utils/vms/vmSetupUserData.ts'

test('the dedicated game catalog has ten distinct games with valid connection ports', () => {
    expect(gameServerCatalog).toHaveLength(10)
    expect(new Set(gameServerCatalog.map(game => game.id)).size).toBe(10)
    expect(new Set(gameServerCatalog.map(game => game.label)).size).toBe(10)
    for (const game of gameServerCatalog) {
        expect(isGameServerService(game.id)).toBe(true)
        expect(getGameServerDefinition(game.id)).toBe(game)
        expect(game.ports.length).toBeGreaterThan(0)
        for (const port of game.ports) {
            expect(port.port).toBeGreaterThan(0)
            expect(port.port).toBeLessThanOrEqual(65535)
            expect(['tcp', 'udp']).toContain(port.protocol)
        }
    }
    expect(isGameServerService('game-made-up')).toBe(false)
    expect(() => gameServerSetupScript('game-made-up', 'guest')).toThrow('Unsupported game server')
})

test('every game setup is a runnable shell script with a real image or official Terraria binary', () => {
    for (const game of gameServerCatalog) {
        const data = vmSetupUserData('game-guest', { os: 'ubuntu-24.04', services: [game.id] })
        const config = parse(data.slice('#cloud-config\n'.length)) as { write_files: Array<{ path: string, content: string }> }
        const script = config.write_files.find(file => file.path === '/usr/local/sbin/hanasand-vm-setup')?.content
        expect(script).toBeTruthy()
        execFileSync('bash', ['-n'], { input: script })
        expect(script).toContain(game.label)
        expect(script).toContain(`sport = :${game.ports[0].port}`)
        if (game.imageTag) {
            expect(script).toContain(`ghcr.io/gameservermanagers/gameserver:${game.imageTag}`)
            expect(script).toContain('docker inspect')
            expect(script).toContain('game_health" == healthy')
        } else if (game.id === 'game-terraria') {
            expect(script).toContain('https://terraria.org/api/get/dedicated-servers-names')
            expect(script).toContain('TerrariaServer.bin.x86_64')
            expect(script).toContain('systemctl enable --now hanasand-game.service')
        } else {
            expect(game.id).toBe('game-teeworlds')
            expect(script).toContain('apt_packages+=(teeworlds-server)')
            expect(script).toContain('ExecStart=/usr/games/teeworlds-server -f server.cfg')
            expect(script).toContain('systemctl enable --now hanasand-game.service')
        }
    }
})

test('game setup refuses incompatible operating systems and multiple games', () => {
    expect(() => vmSetupUserData('game-guest', { os: 'debian-13', services: ['game-luanti'] })).toThrow('Choose one game server')
    expect(() => vmSetupUserData('game-guest', { os: 'ubuntu-24.04', services: ['game-luanti', 'game-factorio'] })).toThrow('Choose one game server')
    expect(() => vmSetupUserData('game-guest', { os: 'ubuntu-24.04', services: ['game-luanti', 'minecraft-java'] })).toThrow('Choose one game server')
})

test('Valheim setup keeps its generated password out of setup logs', () => {
    const script = gameServerSetupScript('game-valheim', 'game-guest')
    expect(script).toContain('valheim-password')
    expect(script).toContain('chmod 0600')
    expect(script).not.toContain('docker logs')
})
