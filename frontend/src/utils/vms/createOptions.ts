export const vmOperatingSystems = [
    { id: 'ubuntu-24.04', label: 'Ubuntu 24.04 LTS', description: 'Stable choice for most projects' },
    { id: 'ubuntu-24.04-desktop', label: 'Ubuntu 24.04 Desktop', description: 'Graphical desktop, accessed through an SSH tunnel · 8 GB RAM and 40 GB disk' },
    { id: 'ubuntu-26.04', label: 'Ubuntu 26.04 LTS', description: 'Latest long-term support release' },
    { id: 'ubuntu-22.04', label: 'Ubuntu 22.04 LTS', description: 'For older software requirements' },
    { id: 'debian-13', label: 'Debian 13', description: 'Stable server release with a minimal base system' },
    { id: 'rocky-9', label: 'Rocky Linux 9', description: 'Enterprise Linux compatible server release' },
] as const

export const vmResourceOptions = [
    { id: 'small', label: 'Small · 1 vCPU · 2 GB · 10 GB disk', cpu: '1', memory: '2GiB', disk: '10GiB' },
    { id: 'standard', label: 'Standard · 2 vCPU · 4 GB · 20 GB disk', cpu: '2', memory: '4GiB', disk: '20GiB' },
    { id: 'large', label: 'Large · 4 vCPU · 8 GB · 40 GB disk', cpu: '4', memory: '8GiB', disk: '40GiB' },
    { id: 'custom', label: 'Custom allocation', cpu: '2', memory: '4GiB', disk: '40GiB' },
] as const

export const vmServices = [
    { id: 'nodejs', group: 'Development', label: 'Node.js + npm', description: 'Node.js 24 LTS and npm' },
    { id: 'bun', group: 'Development', label: 'Bun', description: 'JavaScript runtime and package manager' },
    { id: 'python', group: 'Development', label: 'Python', description: 'Python 3 and pip' },
    { id: 'java', group: 'Development', label: 'Java', description: 'Java runtime and compiler for the selected operating system' },
    { id: 'go', group: 'Development', label: 'Go', description: 'Go compiler and standard toolchain' },
    { id: 'php', group: 'Development', label: 'PHP + Composer', description: 'PHP CLI and Composer package manager' },
    { id: 'rust', group: 'Development', label: 'Rust', description: 'Rust compiler and Cargo package manager' },
    { id: 'ruby', group: 'Development', label: 'Ruby', description: 'Ruby, RubyGems and native extension headers' },
    { id: 'cpp', group: 'Development', label: 'C / C++', description: 'GCC compiler and standard build tools' },
    { id: 'docker', group: 'Development', label: 'Docker', description: 'Docker Engine and Compose' },
    { id: 'postgresql', group: 'Data', label: 'PostgreSQL', description: 'PostgreSQL database server' },
    { id: 'mysql', group: 'Data', label: 'MySQL', description: 'MySQL database server' },
    { id: 'redis', group: 'Data', label: 'Redis', description: 'Redis in-memory data store' },
    { id: 'sqlite', group: 'Data', label: 'SQLite', description: 'Lightweight embedded database and command-line tools' },
    { id: 'nginx', group: 'Web', label: 'Nginx', description: 'Web server for sites and apps' },
    { id: 'website', group: 'Web', label: 'Website', description: 'A responsive site generated from your description or a ready-to-edit starter' },
    { id: 'minecraft-java', group: 'Game servers', label: 'Minecraft Java', description: 'Vanilla or modded server with Paper, Fabric, Quilt, Forge, NeoForge, Purpur or Folia' },
] as const

export const vmServiceTabs = [
    { id: 'development', label: 'Development', groups: ['Development'] },
    { id: 'data', label: 'Data', groups: ['Data'] },
    { id: 'web-games', label: 'Web & games', groups: ['Web', 'Game servers'] },
] as const
export const vmMinecraftServerTypes = [
    { id: 'PAPER', label: 'Paper', description: 'Fast server with plugin support' },
    { id: 'VANILLA', label: 'Vanilla', description: 'The official unmodified server' },
    { id: 'FABRIC', label: 'Fabric', description: 'Lightweight mod support' },
    { id: 'QUILT', label: 'Quilt', description: 'Community mod loader compatible with many Fabric mods' },
    { id: 'NEOFORGE', label: 'NeoForge', description: 'Modded servers for modern Minecraft versions' },
    { id: 'FORGE', label: 'Forge', description: 'A widely used mod loader with a large mod library' },
    { id: 'PURPUR', label: 'Purpur', description: 'Paper-compatible server with more configuration options' },
    { id: 'FOLIA', label: 'Folia', description: 'Region-threaded Paper server for larger worlds' },
] as const

export type VmMinecraftServerType = typeof vmMinecraftServerTypes[number]['id']

export const vmMinecraftAddons = {
    PAPER: [
        { id: 'essentialsx', label: 'EssentialsX', description: 'Homes, warps and useful server commands' },
        { id: 'luckperms', label: 'LuckPerms', description: 'Groups and permissions' },
        { id: 'viaversion', label: 'ViaVersion', description: 'Let newer Minecraft clients join' },
        { id: 'worldedit', label: 'WorldEdit', description: 'Build and edit large areas' },
        { id: 'spark', label: 'spark', description: 'Server performance profiler' },
    ],
    FABRIC: [
        { id: 'fabric-api', label: 'Fabric API', description: 'Common library required by many Fabric mods' },
        { id: 'lithium', label: 'Lithium', description: 'Server-side performance improvements' },
        { id: 'ferritecore', label: 'FerriteCore', description: 'Reduce server memory use' },
        { id: 'krypton', label: 'Krypton', description: 'Optimize Minecraft networking' },
        { id: 'spark', label: 'spark', description: 'Server performance profiler' },
    ],
    FORGE: [
        { id: 'jei', label: 'Just Enough Items', description: 'Browse recipes and items' },
        { id: 'ferritecore', label: 'FerriteCore', description: 'Reduce server memory use' },
        { id: 'modernfix', label: 'ModernFix', description: 'Performance and memory optimizations' },
        { id: 'spark', label: 'spark', description: 'Server performance profiler' },
    ],
} as const

export type VmOperatingSystem = typeof vmOperatingSystems[number]['id']
export type VmService = typeof vmServices[number]['id']
