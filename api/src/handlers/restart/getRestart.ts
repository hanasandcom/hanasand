import config from '#constants'
import sanitize from '#utils/sanitize.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { inspectRuntimeContainer } from '#utils/docker/containers.ts'
import { isProtectedLogsRuntime } from '#utils/docker/protectedRuntime.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'

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

    // Reject recognizable Logs aliases immediately, then inspect every other
    // Docker ID or name before forwarding. Docker accepts both forms, so only
    // checking full IDs would let a Compose-generated name bypass protection.
    if (isProtectedLogsRuntime(id)) {
        return res.status(409).send({ error: 'Logs services cannot be restarted from the system dashboard.' })
    }

    try {
        const container = await inspectRuntimeContainer(id)
        const labels = container.Config?.Labels || {}
        if (isProtectedLogsRuntime(container.Name || '', labels['com.docker.compose.project'], labels['com.docker.compose.service'])) {
            return res.status(409).send({ error: 'Logs services cannot be restarted from the system dashboard.' })
        }
    } catch {
        return res.status(503).send({ error: 'Container identity is unavailable, so this restart was not sent.' })
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
