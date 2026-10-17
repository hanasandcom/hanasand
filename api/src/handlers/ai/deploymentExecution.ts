import config from '#constants'
import { getRepoCredential } from '#utils/ai/repoCredentials.ts'
import { detectRepositoryStack } from '#utils/ai/stack.ts'
import {
    buildOwnedDeploymentProfile,
    collectDeploymentEnvironmentPlaceholders,
    createDeploymentEvent,
    explainDeploymentFailure,
    inferDeployDefaults,
    normalizeDeploymentServiceName,
    normalizeDeploymentStage,
} from '#utils/ai/deploy.ts'
import { fetchWithDeployRetry } from './deploymentRetry.ts'
import type { RepositoryRow, StartDeploymentBody, VMRow } from './deploymentAccess.ts'
import { getConversationForUser } from './shared.ts'

export async function executeDeployment({ repository, vm, body, userId, conversation, accessPolicy, environment }: {
    repository: RepositoryRow
    vm: VMRow
    body: StartDeploymentBody
    userId: string
    conversation: NonNullable<Awaited<ReturnType<typeof getConversationForUser>>>
    accessPolicy: AIDeploymentAccessPolicy
    environment: 'staging' | 'production'
}) {
    const detectedStack = repository.stack_type && repository.stack_type !== 'unknown'
        ? { stackType: repository.stack_type, reason: repository.stack_reason }
        : detectRepositoryStack(repository.files)
    const now = new Date().toISOString()
    const deployDefaults = inferDeployDefaults(detectedStack.stackType, {
        port: body.port,
        healthPath: body.healthPath,
    })
    const port = deployDefaults.port
    const healthPath = deployDefaults.healthPath
    const healthcheckUrl = `http://127.0.0.1:${port}${healthPath}`
    const previewUrl = vm.device_eth0_ipv4_address ? `http://${vm.device_eth0_ipv4_address}:${port}${healthPath}` : null
    const id = `deploy_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const serviceName = normalizeDeploymentServiceName(repository.name || repository.full_name || conversation.title || vm.name)
    const envPlaceholders = collectDeploymentEnvironmentPlaceholders(repository.files)
    const ownedProfile = buildOwnedDeploymentProfile({
        serviceName,
        environment,
        accessPolicy,
        vmName: vm.name,
        port,
        healthPath,
        envPlaceholders,
    })
    const events: AIDeploymentEvent[] = [
        createDeploymentEvent('planned', 'Deployment orchestrator accepted the repository-backed workspace and VM target.', now),
        createDeploymentEvent('sync_access', 'Using the privileged VM deploy bridge, so SSH key sync is not required for this path.', now),
        createDeploymentEvent('planned', detectedStack.stackType === 'unknown' ? 'Stack not confidently recognized. This deployment will wait until the repository matches a supported contract.' : `Detected supported stack: ${detectedStack.stackType}.`, now),
        createDeploymentEvent('planned', ownedProfile.summary, now),
        ...ownedProfile.checklist.map((item) => createDeploymentEvent('planned', item, now)),
    ]
    if (deployDefaults.inferred) {
        events.push(createDeploymentEvent('planned', deployDefaults.reason, now))
    }

    let status: AIDeploymentStatus = 'blocked'
    let failureReason: string | null
    let completedAt: string | null

    if (detectedStack.stackType === 'unknown') {
        completedAt = new Date().toISOString()
        failureReason = explainDeploymentFailure('unsupported_stack', detectedStack.reason)
        events.push(createDeploymentEvent('blocked', failureReason, completedAt))
    } else if (repository.source_path) {
        completedAt = new Date().toISOString()
        failureReason = explainDeploymentFailure('repo_subpath', repository.source_path)
        events.push(createDeploymentEvent('blocked', `This repository is attached from the subpath "${repository.source_path}". The current deploy orchestrator only supports repo-root Docker Compose projects.`, completedAt))
    } else {
        try {
            const repoCredential = await getRepoCredential(repository.id, userId).catch(() => null)
            events.push(createDeploymentEvent('sync', `Preparing ${repository.full_name} on branch ${repository.branch}.`, new Date().toISOString()))

            const deployAttempt = await fetchWithDeployRetry(`${config.internal_api}/vm/${encodeURIComponent(vm.name)}/deploy`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${encodeURIComponent(config.vm_api_token || '')}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'hanasand_api',
                },
                body: JSON.stringify({
                    repoUrl: `https://github.com/${repository.full_name}.git`,
                    branch: repository.branch,
                    serviceName,
                    githubToken: repoCredential?.token || '',
                }),
            }, events, 'remote deploy bridge', 'sync', response => response.json().catch(() => null))
            const deployResponse = deployAttempt.response
            const deployPayload = deployAttempt.body as {
                ok?: boolean
                events?: Array<{ stage?: string; message?: string; timestamp?: string }>
                failureReason?: string
            } | null

            for (const event of Array.isArray(deployPayload?.events) ? deployPayload.events : []) {
                if (typeof event?.stage === 'string' && typeof event?.message === 'string') {
                    events.push(createDeploymentEvent(normalizeDeploymentStage(event.stage), event.message, typeof event.timestamp === 'string' ? event.timestamp : new Date().toISOString()))
                }
            }

            if (!deployResponse.ok || !deployPayload?.ok) {
                status = 'blocked'
                failureReason = explainDeploymentFailure('bridge_failed', deployPayload?.failureReason || `Remote deploy bridge returned HTTP ${deployResponse.status}.`)
                completedAt = new Date().toISOString()
                events.push(createDeploymentEvent('blocked', failureReason, completedAt))
            } else {
                status = 'healthchecking'
                events.push(createDeploymentEvent('healthcheck', `Running VM-local healthcheck on ${healthcheckUrl}.`, new Date().toISOString()))

                const healthAttempt = await fetchWithDeployRetry(`${config.internal_api}/vm/${encodeURIComponent(vm.name)}/request`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${encodeURIComponent(config.vm_api_token || '')}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'hanasand_api',
                    },
                    body: JSON.stringify({
                        method: 'GET',
                        url: healthcheckUrl,
                        headers: { Accept: 'text/html,application/json;q=0.9,*/*;q=0.8' },
                        body: '',
                    }),
                }, events, 'VM-local healthcheck', 'healthcheck', response => response.text())
                const healthResponse = healthAttempt.response
                const healthText = healthAttempt.body
                const eventTime = new Date().toISOString()

                if (healthResponse.ok) {
                    status = 'running'
                    failureReason = null
                    events.push(createDeploymentEvent('healthcheck', `Healthcheck passed with HTTP ${healthResponse.status}.`, eventTime))
                } else {
                    status = 'blocked'
                    failureReason = explainDeploymentFailure('healthcheck_failed', `The service did not answer successfully at ${port}${healthPath}.`)
                    events.push(createDeploymentEvent('healthcheck_failed', `Healthcheck returned HTTP ${healthResponse.status}: ${healthText.slice(0, 280)}`, eventTime))
                    events.push(createDeploymentEvent('blocked', failureReason, eventTime))
                }

                completedAt = new Date().toISOString()
            }
        } catch (error) {
            status = 'blocked'
            failureReason = explainDeploymentFailure('unexpected', error instanceof Error ? error.message : 'Unable to reach the VM deploy bridge.')
            completedAt = new Date().toISOString()
            events.push(createDeploymentEvent('blocked', failureReason, completedAt))
        }
    }


    return { id, detectedStack, status, failureReason, completedAt, events, serviceName, previewUrl, healthcheckUrl, accessPolicy, environment, ownedProfile, envPlaceholders }
}
