export const supportedSetupServices = [
    'nodejs', 'postgresql', 'mysql', 'sqlite', 'redis', 'python', 'bun',
    'docker', 'java', 'go', 'php', 'nginx', 'website', 'minecraft-java',
] as const

export type SupportedVmSetupService = typeof supportedSetupServices[number]

const supportedSetupServiceSet: ReadonlySet<string> = new Set(supportedSetupServices)

export function isSupportedSetupService(value: unknown): value is SupportedVmSetupService {
    return typeof value === 'string' && supportedSetupServiceSet.has(value)
}
