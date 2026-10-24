import { hasVmAccess } from '#utils/vms/access.ts'
import { vmLifecycleLock } from '#utils/vms/lifecycleLock.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'
import sanitize from '#utils/sanitize.ts'
import run from '#db'
import config from '#constants'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { internalHostFetch } from '#utils/vms/hostTransport.ts'
import { invalidateLiveVmStatus } from '#utils/vms/status.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { setLocalLxdInstanceState } from '#utils/vms/lxd.ts'

const allowedActions = new Set(['start', 'stop', 'restart'])

export default async function vmAction(req: FastifyRequest, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }
    const { valid: validRole } = await hasHanasandInternalRouteAccess(req)

    const { id: rawId, action: rawAction } = req.params as { id: string, action: string }
    const id = sanitize(rawId)
    const action = sanitize(rawAction)

    if (!id || !action || !allowedActions.has(action)) {
        return res.status(400).send({ error: 'Invalid VM action.' })
    }

    try {
        return await vmLifecycleLock(id, async () => {
            const vm = await loadManageableVm(id)
            if (!vm) {
                return res.status(404).send({ error: `Virtual machine ${id} was not found.` })
            }

            if (!validRole && !await hasVmAccess(vm.name, userId, true)) {
                return res.status(403).send({ error: 'You do not have access to manage this virtual machine.' })
            }

            if (vm.deleted_at) return res.status(409).send({ error: 'This VM is scheduled for deletion. Restore it before starting.' })

            let payload: Record<string, unknown>
            if (config.lxd_project) {
                await setLocalLxdInstanceState(vm.name, action as 'start' | 'stop' | 'restart')
                payload = { message: `VM ${vm.name} ${action} command completed.`, name: vm.name }
            } else {
                const internalRes = await internalHostFetch(vm.primary_host, `/vm/${encodeURIComponent(vm.name)}/${action}`, {
                    method: 'POST',
                    headers: {
                        'User-Agent': 'hanasand_internal',
                    },
                })

                const text = await internalRes.text()
                payload = parseInternalPayload(text)

                if (!internalRes.ok) {
                    return res.status(internalRes.status).send({
                        error: describeVmActionError(payload, action, id),
                        details: payload,
                    })
                }
            }

            invalidateLiveVmStatus(vm.name)
            const nextStatus = action === 'stop' ? 'stopped' : 'running'
            await run(`
            UPDATE vm_details
            SET status = $2,
                volatile_last_state_power = UPPER($2),
                last_checked = NOW()
            WHERE name = $1
        `, [id, nextStatus]).catch((error) => {
                req.log.warn({ err: error, id, action }, 'Unable to update cached VM status after action.')
            })

            await recordSystemEvent(req, {
                actionType: `vm.${action}`,
                actorId: userId,
                targetType: 'vm',
                targetId: id,
                context: { status: nextStatus, execution: config.lxd_project ? 'local_lxd' : 'internal_vm_api' },
            })

            return res.send(payload)
        })
    } catch (error) {
        req.log.error(error)
        if (error instanceof Error && /timeout|timed out/i.test(error.message)) {
            return res.status(504).send({
                error: `The ${action} request timed out. The VM may still be processing it; check its status before trying again.`,
            })
        }
        return res.status(500).send({ error: config.lxd_project ? 'Unable to contact the local VM host.' : 'Unable to contact internal VM API.' })
    }
}

async function loadManageableVm(id: string) {
    const result = await run(`
        SELECT name, owner, created_by, access_users, primary_host, deleted_at
        FROM vms
        WHERE LOWER(name) = LOWER($1)
        LIMIT 1
    `, [id])

    return result.rows[0] as {
        name: string
        owner: string
        created_by: string
        access_users: string[] | null
        primary_host: string
        deleted_at: string | null
    } | undefined
}

function parseInternalPayload(text: string) {
    if (!text) {
        return {}
    }

    try {
        return JSON.parse(text) as Record<string, unknown>
    } catch {
        return { error: text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || 'Internal VM API returned an unreadable response.' }
    }
}

function describeVmActionError(payload: Record<string, unknown>, action: string, id: string) {
    const error = typeof payload.error === 'string' ? payload.error : ''
    const stderr = typeof payload.stderr === 'string' ? payload.stderr : ''
    const detail = error || stderr || 'No details returned.'
    return `Unable to ${action} virtual machine ${id}: ${detail}`
}
