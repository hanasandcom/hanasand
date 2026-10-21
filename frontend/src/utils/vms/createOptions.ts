export const vmOperatingSystems = [
    { id: 'ubuntu-24.04', label: 'Ubuntu 24.04 LTS' },
    { id: 'ubuntu-22.04', label: 'Ubuntu 22.04 LTS' },
] as const

export const vmServices = [
    { id: 'nodejs', label: 'Node.js + npm', description: 'Node.js runtime and npm package manager' },
    { id: 'postgresql', label: 'PostgreSQL', description: 'PostgreSQL database server' },
    { id: 'redis', label: 'Redis', description: 'Redis in-memory data store' },
    { id: 'python', label: 'Python', description: 'Python 3 and pip' },
] as const

export type VmOperatingSystem = typeof vmOperatingSystems[number]['id']
export type VmService = typeof vmServices[number]['id']
