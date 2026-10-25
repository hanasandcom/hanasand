import config from '#constants'
import sanitize from '#utils/sanitize.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { inspectRuntimeContainer } from '#utils/docker/containers.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'

function isLogsRuntime(name: string, project?: string, service?: string) {
    const normalized = name.replace(/^\/+/, '').toLowerCase()
    return normalized === 'processor'
        || normalized === 'logs'
        || normalized === 'hanasand-log-collector'
        || normalized.startsWith('logs-')
        || normalized.startsWith('logs_')
        || project?.toLowerCase() === 'logs'
        || Boolean(service && /^logs[-_]/i.test(service))
}

export default async function restartHandler(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id: rawId } = req.params as { id: string }
    const id = sanitize(rawId)
    if (!id) {
        return res.status(400).send({ error: 'No service provided' })
    }

    // The System dashboard passes Docker container IDs. Resolve those IDs
    // before proxying a restart so the Logs API, worker, database and collector
    // cannot be interrupted through this generic service action.
    if (isLogsRuntime(id)) {
        return res.status(409).send({ error: 'Logs services cannot be restarted from the system dashboard.' })
    }
    if (/^[a-f0-9]{12,64}$/i.test(id)) {
        try {
            const container = await inspectRuntimeContainer(id)
            const labels = container.Config?.Labels || {}
            if (isLogsRuntime(container.Name || '', labels['com.docker.compose.project'], labels['com.docker.compose.service'])) {
                return res.status(409).send({ error: 'Logs services cannot be restarted from the system dashboard.' })
            }
        } catch {
            return res.status(503).send({ error: 'Container identity is unavailable, so this restart was not sent.' })
        }
    }

    try {
        const internalRes = await fetch(`${config.internal_api}/docker/restart/${id}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${encodeURIComponent(config.vm_api_token || '')}`,
                'User-Agent': 'hanasand_internal'
            }
        })

        const json = await internalRes.json()

        if (!internalRes.ok) {
            return res.status(internalRes.status).send(json)
        }

        return res.send({ ok: true, detail: json })
    } catch (err: any) {
        console.error(`Error calling internal redeploy for ${id}:`, err)
        return res.status(500).send({ error: err.message })
    }
}
