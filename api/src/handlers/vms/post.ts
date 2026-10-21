import { vmLifecycleLock } from '#utils/vms/lifecycleLock.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { loadSQL } from '#utils/loadSQL.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'
import hasInternalToken from '#utils/auth/internalToken.ts'
import syncUserCertificatesToVm from '#utils/vms/syncUserCertificatesToVm.ts'
import config from '#constants'
import { internalHostFetch } from '#utils/vms/hostTransport.ts'
import provisionVmOnHost, { type VmProvisionOptions } from '#utils/vms/provisionOnHost.ts'
import recordLog from '#utils/logs/recordLog.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'

export default async function postVM(req: FastifyRequest, res: FastifyReply) {
    const body = req.body as {
        name: string
        owner?: string
        created_by?: string
        access_users?: string[]
        provision_local?: boolean
        os?: VmProvisionOptions['os']
        services?: VmProvisionOptions['services']
    } ?? {}
    const { name, access_users } = body
    const provisionOptions = normalizeProvisionOptions(body.os, body.services)
    if (!provisionOptions) return res.status(400).send({ error: 'Choose a supported operating system and services.' })
    let owner = body.owner
    let created_by = body.created_by

    const internal = hasInternalToken(req)
    let actorId: string | null = null
    let canAssignOwner = internal
    if (!internal) {
        const { valid, id } = await tokenWrapper(req, res)
        if (!valid || !id) {
            return res.status(401).send({ error: 'Unauthorized.' })
        }

        const { valid: validRole } = await hasHanasandInternalRouteAccess(req)
        canAssignOwner = validRole
        actorId = id
        owner = validRole ? owner || id : id
        created_by = validRole ? created_by || id : id
    }

    if (!name || !owner || !created_by) {
        return res.status(400).send({ error: 'Missing required fields' })
    }

    if (!canAssignOwner && !/^[a-z][a-z0-9-]{0,61}[a-z0-9]$/.test(name)) return res.status(400).send({ error: 'Use 2–63 lowercase letters, numbers or hyphens, starting with a letter.' })

    try {
        return await vmLifecycleLock(name, async () => {
            if (canAssignOwner) await run(`
            DELETE FROM vms
            WHERE name = $1
              AND deleted_at IS NULL
              AND owner = 'ownerless'
              AND EXISTS (
                  SELECT 1
                  FROM vms owned
                  WHERE LOWER(owned.name) = LOWER($1)
                    AND owned.name <> $1
                    AND owned.owner <> 'ownerless'
              )
        `, [name])

            const existingResult = await run(`
            SELECT name, owner, created_by, access_users, primary_host, deleted_at,
                   EXISTS (SELECT 1 FROM vm_details d WHERE d.name = vms.name) AS has_vm_details
            FROM vms
            WHERE LOWER(name) = LOWER($1)
            ORDER BY
                CASE WHEN owner = 'ownerless' THEN 1 ELSE 0 END,
                CASE WHEN name = $1 THEN 0 ELSE 1 END
            LIMIT 1
        `, [name])
            const existing = existingResult.rows[0] as {
                name: string
                owner: string
                created_by: string
                access_users: string[]
                primary_host: string
                deleted_at?: string | null
                has_vm_details: boolean
            } | undefined

            if (existing?.deleted_at) return res.status(409).send({ error: 'This VM is scheduled for deletion. Restore it before making changes.' })

            if (existing && !canAssignOwner) {
                if (existing.owner !== actorId || existing.has_vm_details || body.provision_local === false) return res.status(409).send({ error: 'VM already exists.' })
                queueUserProvision(name, existing.primary_host, provisionOptions, [existing.owner, existing.created_by, ...(existing.access_users ?? [])])
                return res.status(201).send(existing)
            }

            if (existing) {
                const nextOwner = owner === 'ownerless' ? existing.owner : owner
                const nextCreatedBy = created_by === 'unknown' ? existing.created_by : created_by
                const nextAccessUsers = (access_users ?? []).length ? access_users : existing.access_users

                const result = await run(`
                UPDATE vms
                SET name = $1,
                    owner = $2,
                    created_by = $3,
                    access_users = $4,
                    primary_host = $6
                WHERE name = $5
                RETURNING *
            `, [name, nextOwner, nextCreatedBy, JSON.stringify(nextAccessUsers ?? []), existing.name, existing.primary_host])

                if (canAssignOwner) {
                    await provisionOnPrimaryHost(name, existing.primary_host, body.provision_local !== false, provisionOptions)
                    if (body.provision_local !== false) await syncCertificates(name, [nextOwner, nextCreatedBy, ...(nextAccessUsers ?? [])])
                }
                else if (body.provision_local !== false) queueUserProvision(name, existing.primary_host, provisionOptions, [nextOwner, nextCreatedBy, ...(nextAccessUsers ?? [])])

                await recordSystemEvent(req, {
                    actionType: 'vm.access.updated',
                    actorId,
                    targetType: 'vm',
                    targetId: name,
                    context: {
                        owner: nextOwner,
                        creator: nextCreatedBy,
                        accessUsers: nextAccessUsers ?? [],
                        previousOwner: existing.owner,
                        previousCreator: existing.created_by,
                        previousAccessUsers: existing.access_users ?? [],
                    },
                })

                return res.status(201).send(result.rows[0])
            }

            if (canAssignOwner) await run(`
            UPDATE vms
            SET name = $1
            WHERE LOWER(name) = LOWER($1)
              AND name <> $1
              AND NOT EXISTS (SELECT 1 FROM vms WHERE name = $1)
        `, [name])

            const query = canAssignOwner ? await loadSQL('insertVM.sql') : 'INSERT INTO vms (name, owner, created_by, access_users) VALUES ($1, $2, $3, $4) ON CONFLICT (name) DO NOTHING RETURNING *'
            const result = await run(query, [name, owner, created_by, JSON.stringify(access_users ?? [])])
            if (!result.rows.length) {
                return res.status(409).send({ error: 'VM already exists' })
            }

            const assignedVm = await run('UPDATE vms SET primary_host = $2 WHERE name = $1 RETURNING *', [name, config.vm_host_id])
            if (!assignedVm.rows[0]) throw new Error('VM primary host assignment did not update the new VM.')
            if (canAssignOwner) {
                await provisionOnPrimaryHost(name, config.vm_host_id, body.provision_local !== false, provisionOptions)
                if (body.provision_local !== false) await syncCertificates(name, [owner, created_by, ...(access_users ?? [])])
            }
            else if (body.provision_local !== false) queueUserProvision(name, config.vm_host_id, provisionOptions, [owner, created_by, ...(access_users ?? [])])

            await recordSystemEvent(req, {
                actionType: 'vm.created',
                actorId,
                targetType: 'vm',
                targetId: name,
                context: {
                    owner,
                    creator: created_by,
                    accessUsers: access_users ?? [],
                },
            })

            return res.status(201).send(assignedVm.rows[0])
        })
    } catch (error) {
        req.log.error({ err: error, vmName: name }, 'Unable to create or provision VM.')
        void recordVmProvisioningError(name || 'unknown', error, 'create_or_provision')
        return res.status(500).send({ error: 'Internal server error' })
    }
}

async function provisionOnPrimaryHost(name: string, host: string, shouldProvision: boolean, options?: VmProvisionOptions) {
    if (shouldProvision) await provisionVmOnHost(host, name, internalHostFetch, options)
}

function queueUserProvision(name: string, host: string, options: VmProvisionOptions, userIds: string[]) {
    void provisionOnPrimaryHost(name, host, true, options).then(async () => {
        await syncUserCertificatesToVm({ vmName: name, userIds }).catch(error => {
            void recordVmProvisioningError(name, error, 'certificate_sync')
        })
    }).catch(error => void recordVmProvisioningError(name, error, 'create_or_provision'))
}

async function syncCertificates(vmName: string, userIds: string[]) {
    await syncUserCertificatesToVm({ vmName, userIds }).catch(error => {
        void recordVmProvisioningError(vmName, error, 'certificate_sync')
    })
}

function normalizeProvisionOptions(os: unknown, services: unknown): VmProvisionOptions | null {
    const supportedOs = new Set(['ubuntu-24.04', 'ubuntu-22.04'])
    const supportedServices = new Set(['nodejs', 'postgresql', 'redis', 'python'])
    if (os !== undefined && (typeof os !== 'string' || !supportedOs.has(os))) return null
    if (services !== undefined && (!Array.isArray(services) || services.length > 4 || services.some(service => typeof service !== 'string' || !supportedServices.has(service)))) return null
    return {
        os: (os || 'ubuntu-24.04') as VmProvisionOptions['os'],
        services: [...new Set((services || []) as NonNullable<VmProvisionOptions['services']>)],
    }
}

async function recordVmProvisioningError(vmName: string, error: unknown, phase: string) {
    await recordLog({
        level: 'error',
        message: `VM provisioning ${phase} failed for ${vmName}: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
            category: 'vm_provisioning_error',
            vmName,
            phase,
        },
    }).catch(() => {})
}
