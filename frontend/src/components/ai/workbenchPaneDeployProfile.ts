export function detectEnvPlaceholders(repo: AIImportedRepo | null) {
    if (!repo) {
        return []
    }

    const names = new Set<string>()
    for (const file of repo.files) {
        const path = file.path.toLowerCase()
        const content = file.content || ''
        if (path.endsWith('.env.example') || path.endsWith('.env.template') || path === '.env.example') {
            for (const line of content.split('\n')) {
                const match = line.match(/^\s*([A-Z][A-Z0-9_]{1,80})\s*=/)
                if (match) {
                    names.add(match[1])
                }
            }
        }

        for (const match of content.matchAll(/\b(?:process\.env|import\.meta\.env)\.([A-Z][A-Z0-9_]{1,80})\b/g)) {
            names.add(match[1])
        }
    }

    return Array.from(names)
        .filter((name) => !['NODE_ENV', 'PORT', 'HOST', 'HOSTNAME'].includes(name))
        .sort()
}

export function buildDeployProfile({
    environment,
    vmName,
    port,
    healthPath,
    accessPolicy,
    activeRepo,
    activeConversation,
    envPlaceholders,
}: {
    environment: AIDeploymentEnvironment
    vmName: string
    port: string
    healthPath: string
    accessPolicy: AIDeploymentAccessPolicy
    activeRepo: AIImportedRepo | null
    activeConversation: AIConversation | null
    envPlaceholders: string[]
}) {
    const service = sanitizeLabel(activeRepo?.name || activeConversation?.title || 'repository')
    const domain = environment === 'production'
        ? `${service}.hanasand.com`
        : `${service}.staging.hanasand.com`
    const checklist: Array<{ label: string, state: 'ready' | 'needs_input' | 'automatic' }> = [
        { label: `Launch target: ${vmName || 'choose a target'}`, state: vmName ? 'ready' : 'needs_input' },
        { label: `Domain profile: ${domain}`, state: 'automatic' },
        { label: 'SSL certificate after route is live', state: 'automatic' },
        { label: `Health check: ${port || 'port'}${healthPath || '/'}`, state: port && healthPath ? 'ready' : 'needs_input' },
        { label: envPlaceholders.length ? `${envPlaceholders.length} env placeholder${envPlaceholders.length === 1 ? '' : 's'} detected` : 'No env placeholders detected', state: 'automatic' },
        { label: `Access policy: ${accessPolicy.replaceAll('_', ' ')}`, state: 'ready' },
        { label: 'Build logs, launch events, and rollback target recorded', state: 'automatic' },
    ]

    return {
        title: `${environment === 'production' ? 'Production' : 'Staging'} infrastructure profile`,
        domain,
        ssl: 'Automatic after domain route responds',
        logs: 'Build, health check, preview, and launch events',
        rollback: 'Previous launch is selectable from launch history',
        checklist,
    }
}

function sanitizeLabel(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'repository'
}
