const NEXTJS_DEFAULTS = {
    port: 3000,
    healthPath: '/',
}

const FASTIFY_DEFAULTS = {
    port: 3001,
    healthPath: '/ready',
}

export type DeployDefaults = {
    port: number
    healthPath: string
    inferred: boolean
    reason: string
}

export type OwnedDeploymentProfileInput = {
    serviceName: string
    environment: 'staging' | 'production'
    accessPolicy: AIDeploymentAccessPolicy
    vmName: string
    port: number
    healthPath: string
    envPlaceholders: string[]
}

export function normalizeDeploymentServiceName(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'workspace'
}

export function collectDeploymentEnvironmentPlaceholders(files: AIImportedRepoFile[]) {
    const names = new Set<string>()
    for (const file of files) {
        const path = file.path.toLowerCase()
        const content = file.content || ''
        if (path.endsWith('.env.example') || path.endsWith('.env.template')) {
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

export function buildOwnedDeploymentProfile({
    serviceName,
    environment,
    accessPolicy,
    vmName,
    port,
    healthPath,
    envPlaceholders,
}: OwnedDeploymentProfileInput) {
    const domain = environment === 'production'
        ? `${serviceName}.hanasand.com`
        : `${serviceName}.staging.hanasand.com`
    return {
        domain,
        summary: `Owned ${environment} deployment profile: domain ${domain}, automatic SSL after routing, VM ${vmName}, access ${accessPolicy.replaceAll('_', ' ')}.`,
        checklist: [
            `Deploy checklist: domain route ${domain} will be owned by Hanasand infrastructure.`,
            'Deploy checklist: SSL is expected after the domain route responds; certificate contents are never printed.',
            `Deploy checklist: health check will run after launch at ${port}${healthPath}.`,
            envPlaceholders.length
                ? `Deploy checklist: ${envPlaceholders.length} environment placeholder${envPlaceholders.length === 1 ? '' : 's'} detected (${envPlaceholders.join(', ')}); values are never echoed.`
                : 'Deploy checklist: no required environment placeholders were detected from imported files.',
            'Deploy checklist: build logs, VM bridge events, health result, and release record are persisted for refresh and reporting.',
            'Deploy checklist: previous releases remain selectable as rollback targets before production cutover.',
        ],
    }
}

export function explainDeploymentFailure(kind: 'unsupported_stack' | 'repo_subpath' | 'bridge_failed' | 'healthcheck_failed' | 'unexpected', detail?: string | null) {
    switch (kind) {
        case 'unsupported_stack':
            return `This project is not deployable yet because Hanasand could not find a supported Docker deployment shape. Add a Dockerfile and docker-compose.yml at the repo root, then try again. ${detail || ''}`.trim()
        case 'repo_subpath':
            return `This project was imported from a subfolder, so the deploy runner cannot safely own the full release yet. Re-import the repository from its root, then deploy again. Subfolder: ${detail || 'unknown'}.`
        case 'bridge_failed':
            return `The server could not complete the VM deployment step. No production traffic was moved. The next check is the deploy log for the VM bridge. ${detail || ''}`.trim()
        case 'healthcheck_failed':
            return `The build finished, but the launched app did not pass its health check. Visitors were not promoted to this release. Check that the app listens on the selected port/path, then retry. ${detail || ''}`.trim()
        case 'unexpected':
            return `The deploy could not be completed because the deployment service returned an unexpected error. No secret values were printed and no release was promoted. ${detail || ''}`.trim()
    }
}

export function normalizeDeploymentStage(stage: string): AIDeploymentStage {
    switch (stage) {
        case 'clone':
            return 'clone'
        case 'sync':
        case 'fetch':
        case 'checkout':
        case 'pull':
            return 'sync'
        case 'build':
            return 'build'
        case 'run':
        case 'running':
            return 'run'
        case 'healthcheck':
            return 'healthcheck'
        case 'healthcheck_failed':
            return 'healthcheck_failed'
        case 'auth':
            return 'sync_access'
        case 'blocked':
        case 'compose_missing':
            return 'blocked'
        default:
            return 'planned'
    }
}

export function createDeploymentEvent(stage: AIDeploymentStage, message: string, timestamp: string): AIDeploymentEvent {
    return { stage, message, timestamp }
}

export function inferDeployDefaults(stackType: AIStackType, input?: { port?: unknown, healthPath?: unknown }): DeployDefaults {
    const stackDefaults = getStackDefaults(stackType)
    const rawPort = typeof input?.port === 'number' || typeof input?.port === 'string'
        ? Number(input?.port)
        : Number.NaN
    const requestedHealthPath = typeof input?.healthPath === 'string' ? input.healthPath.trim() : ''
    const port = Number.isFinite(rawPort) && rawPort > 0 ? Math.trunc(rawPort) : stackDefaults.port
    const healthPath = normalizeHealthPath(requestedHealthPath || stackDefaults.healthPath)
    const inferredPort = !Number.isFinite(rawPort) || rawPort <= 0
    const inferredPath = requestedHealthPath.length === 0

    return {
        port,
        healthPath,
        inferred: inferredPort || inferredPath,
        reason: inferredPort || inferredPath
            ? `Using ${stackType === 'unknown' ? 'fallback' : stackType.replaceAll('_', ' ')} deploy defaults (${port}${healthPath}).`
            : 'Using explicit deploy port and health path.',
    }
}

export function parseHealthcheckUrlDefaults(healthcheckUrl: string | null | undefined, stackType: AIStackType): DeployDefaults {
    if (typeof healthcheckUrl === 'string' && healthcheckUrl.trim().length > 0) {
        try {
            const target = new URL(healthcheckUrl)
            return {
                port: Number(target.port || getStackDefaults(stackType).port),
                healthPath: normalizeHealthPath(target.pathname || '/'),
                inferred: false,
                reason: `Reusing release healthcheck target ${target.port || getStackDefaults(stackType).port}${target.pathname || '/'} for restore.`,
            }
        } catch {
            return inferDeployDefaults(stackType)
        }
    }

    return inferDeployDefaults(stackType)
}

function getStackDefaults(stackType: AIStackType) {
    switch (stackType) {
        case 'fastify_postgres':
        case 'fastify_worker_redis':
            return FASTIFY_DEFAULTS
        case 'nextjs_docker':
            return NEXTJS_DEFAULTS
        default:
            return NEXTJS_DEFAULTS
    }
}

function normalizeHealthPath(path: string) {
    const trimmed = path.trim()
    if (!trimmed) {
        return '/'
    }

    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}
