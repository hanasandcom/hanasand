const addonsByServerType = {
    PAPER: ['essentialsx', 'luckperms', 'viaversion', 'viabackwards', 'worldedit', 'placeholderapi', 'chunky'],
    PURPUR: ['essentialsx', 'luckperms', 'viaversion', 'viabackwards', 'worldedit', 'placeholderapi', 'chunky'],
    FOLIA: ['viaversion', 'viabackwards', 'placeholderapi', 'chunky'],
    FABRIC: ['fabric-api', 'lithium', 'ferritecore', 'krypton', 'carpet', 'chunky', 'spark'],
    QUILT: ['qsl', 'lithium', 'ferritecore', 'spark'],
    FORGE: ['jei', 'ferritecore', 'modernfix', 'chunky', 'spark'],
    NEOFORGE: ['jei', 'ferritecore', 'modernfix', 'chunky', 'spark'],
} as const

export function normalizeMinecraftAddons(value: unknown, serverType: string) {
    if (value === undefined) return []
    if (!Array.isArray(value) || value.length > 8 || value.some(item => typeof item !== 'string')) return null
    const supported = (addonsByServerType as Record<string, readonly string[]>)[serverType] || []
    const addons = [...new Set(value as string[])]
    if (addons.some(addon => !supported.includes(addon))) return null
    if (serverType === 'FABRIC' && addons.includes('lithium') && !addons.includes('fabric-api')) addons.unshift('fabric-api')
    if (serverType === 'QUILT' && addons.some(addon => ['lithium', 'ferritecore', 'spark'].includes(addon)) && !addons.includes('qsl')) addons.unshift('qsl')
    if (addons.includes('viabackwards') && !addons.includes('viaversion')) addons.unshift('viaversion')
    return addons
}

export function minecraftAddonLoader(serverType: string) {
    if (serverType === 'PAPER' || serverType === 'PURPUR') return 'paper'
    if (serverType === 'FOLIA') return 'folia'
    if (serverType === 'FABRIC') return 'fabric'
    if (serverType === 'QUILT') return 'quilt'
    if (serverType === 'FORGE') return 'forge'
    if (serverType === 'NEOFORGE') return 'neoforge'
    return null
}
