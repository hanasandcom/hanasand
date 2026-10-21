export const vmOperatingSystems = [
    { id: 'ubuntu-24.04', label: 'Ubuntu 24.04 LTS', description: 'Stable choice for most projects' },
    { id: 'ubuntu-26.04', label: 'Ubuntu 26.04 LTS', description: 'Latest long-term support release' },
    { id: 'ubuntu-22.04', label: 'Ubuntu 22.04 LTS', description: 'For older software requirements' },
] as const

export const vmResourceOptions = [
    { id: 'small', label: 'Small · 1 vCPU · 2 GB', cpu: '1', memory: '2GiB' },
    { id: 'standard', label: 'Standard · 2 vCPU · 4 GB', cpu: '2', memory: '4GiB' },
    { id: 'large', label: 'Large · 4 vCPU · 8 GB', cpu: '4', memory: '8GiB' },
] as const

export const vmServices = [
    { id: 'nodejs', group: 'Development', label: 'Node.js + npm', description: 'Node.js 24 LTS and npm' },
    { id: 'bun', group: 'Development', label: 'Bun', description: 'JavaScript runtime and package manager' },
    { id: 'python', group: 'Development', label: 'Python', description: 'Python 3 and pip' },
    { id: 'java', group: 'Development', label: 'Java', description: 'Java 21 runtime' },
    { id: 'docker', group: 'Development', label: 'Docker', description: 'Docker Engine and Compose' },
    { id: 'postgresql', group: 'Data', label: 'PostgreSQL', description: 'PostgreSQL database server' },
    { id: 'redis', group: 'Data', label: 'Redis', description: 'Redis in-memory data store' },
    { id: 'nginx', group: 'Web', label: 'Nginx', description: 'Web server for sites and apps' },
    { id: 'website', group: 'Web', label: 'Website starter', description: 'A starter HTML page served by Nginx' },
    { id: 'minecraft-java', group: 'Game servers', label: 'Minecraft Java', description: 'Paper server on port 25565, ready for the port 443 gateway' },
] as const

export const vmServiceGroups = ['Development', 'Data', 'Web', 'Game servers'] as const

export type VmOperatingSystem = typeof vmOperatingSystems[number]['id']
export type VmService = typeof vmServices[number]['id']
