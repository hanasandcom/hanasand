import { expect, test } from 'bun:test'
import { minecraftAddonLoader, normalizeMinecraftAddons } from '../src/utils/vms/minecraftAddons.ts'

test('Minecraft add-on choices match their server loader and include required dependencies', () => {
    expect(normalizeMinecraftAddons(['viabackwards'], 'PAPER')).toEqual(['viaversion', 'viabackwards'])
    expect(normalizeMinecraftAddons(['lithium'], 'FABRIC')).toEqual(['fabric-api', 'lithium'])
    expect(normalizeMinecraftAddons(['lithium'], 'QUILT')).toEqual(['qsl', 'lithium'])
    expect(normalizeMinecraftAddons(['qsl'], 'QUILT')).toEqual(['qsl'])
    expect(normalizeMinecraftAddons(['chunky'], 'FOLIA')).toEqual(['chunky'])
    expect(normalizeMinecraftAddons(['jei'], 'NEOFORGE')).toEqual(['jei'])
    expect(normalizeMinecraftAddons(['carpet'], 'QUILT')).toBeNull()
    expect(minecraftAddonLoader('FOLIA')).toBe('folia')
    expect(normalizeMinecraftAddons(['essentialsx', 'luckperms', 'viaversion', 'viabackwards', 'worldedit', 'placeholderapi', 'chunky'], 'PAPER')).toHaveLength(7)
    expect(normalizeMinecraftAddons(['essentialsx', 'luckperms', 'viaversion', 'viabackwards', 'worldedit', 'placeholderapi', 'chunky', 'invalid'], 'PAPER')).toBeNull()
})
