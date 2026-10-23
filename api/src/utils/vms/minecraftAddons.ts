const addonsByServerType = {
    PAPER: ['essentialsx', 'luckperms', 'viaversion', 'worldedit', 'spark'],
    PURPUR: ['essentialsx', 'luckperms', 'viaversion', 'worldedit', 'spark'],
    FABRIC: ['fabric-api', 'lithium', 'ferritecore', 'krypton', 'spark'],
    QUILT: ['fabric-api', 'lithium', 'ferritecore', 'krypton', 'spark'],
    FORGE: ['jei', 'ferritecore', 'modernfix', 'spark'],
    NEOFORGE: ['jei', 'ferritecore', 'modernfix', 'spark'],
} as const

export function normalizeMinecraftAddons(value: unknown, serverType: string) {
    if (value === undefined) return []
    if (!Array.isArray(value) || value.length > 5 || value.some(item => typeof item !== 'string')) return null
    const supported = (addonsByServerType as Record<string, readonly string[]>)[serverType] || []
    const addons = [...new Set(value as string[])]
    if (addons.some(addon => !supported.includes(addon))) return null
    if (addons.includes('lithium') && !addons.includes('fabric-api')) addons.unshift('fabric-api')
    return addons
}

export function minecraftAddonLoader(serverType: string) {
    if (serverType === 'PAPER' || serverType === 'PURPUR') return 'paper'
    if (serverType === 'FABRIC') return 'fabric'
    if (serverType === 'QUILT') return 'quilt'
    if (serverType === 'FORGE') return 'forge'
    if (serverType === 'NEOFORGE') return 'neoforge'
    return null
}
