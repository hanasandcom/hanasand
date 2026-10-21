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
        organization_id?: string | null
        os?: VmProvisionOptions['os']
        resources?: VmProvisionOptions['resources']
        services?: VmProvisionOptions['services']
        minecraft_eula_accepted?: boolean
        minecraft_server_type?: VmProvisionOptions['minecraftServerType']
        website?: unknown
    } ?? {}
    const { name, access_users } = body
    const provisionOptions = normalizeProvisionOptions(body.os, body.resources, body.services, body.minecraft_eula_accepted, body.minecraft_server_type, body.website)
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

    if (body.organization_id !== undefined && body.organization_id !== null
        && (typeof body.organization_id !== 'string' || !body.organization_id.trim())) {
        return res.status(400).send({ error: 'Choose a valid organization.' })
    }
    const organizationId = typeof body.organization_id === 'string' ? body.organization_id.trim() : null
    if (organizationId) {
        if (!actorId) return res.status(400).send({ error: 'Organization assignment requires an authenticated user.' })
        const organization = await run(`
            SELECT o.id
            FROM organizations o
            JOIN organization_members m ON m.organization_id = o.id
            WHERE o.id = $1 AND o.status = 'active'
              AND m.user_id = $2 AND m.status = 'active' AND m.role IN ('owner', 'admin')
            LIMIT 1
        `, [organizationId, actorId])
        if (!organization.rows[0]) return res.status(403).send({ error: 'An organization owner or admin must create VMs.' })
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
            SELECT name, owner, created_by, access_users, primary_host, organization_id, deleted_at,
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
                organization_id?: string | null
                deleted_at?: string | null
                has_vm_details: boolean
            } | undefined

            if (existing?.deleted_at) return res.status(409).send({ error: 'This VM is scheduled for deletion. Restore it before making changes.' })
            if (existing && (existing.organization_id ?? null) !== organizationId) return res.status(409).send({ error: 'A VM with the name already exists in another workspace.' })

            if (existing && !canAssignOwner) {
                if (existing.owner !== actorId || existing.has_vm_details || body.provision_local === false) return res.status(409).send({ error: 'VM already exists.' })
                if (provisionOptions.services?.includes('website')) await ensureWebsitePublicRoute(name, actorId)
                queueVmProvision(name, existing.primary_host, provisionOptions, [existing.owner, existing.created_by, ...(existing.access_users ?? [])])
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

                if (body.provision_local !== false && provisionOptions.services?.includes('website')) await ensureWebsitePublicRoute(name, actorId || nextCreatedBy)
                if (body.provision_local !== false) queueVmProvision(name, existing.primary_host, provisionOptions, [nextOwner, nextCreatedBy, ...(nextAccessUsers ?? [])])

                await recordSystemEvent(req, {
                    actionType: 'vm.access.updated',
                    actorId,
                    targetType: 'vm',
                    targetId: name,
                    organizationId,
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

            const query = organizationId
                ? `INSERT INTO vms (name, owner, created_by, access_users, organization_id)
                   SELECT $1, $2, $3, $4, $5
                   WHERE EXISTS (
                       SELECT 1 FROM organization_members
                       WHERE organization_id = $5 AND user_id = $2 AND status = 'active' AND role IN ('owner', 'admin')
                   )
                   ON CONFLICT (name) DO NOTHING RETURNING *`
                : canAssignOwner
                    ? await loadSQL('insertVM.sql')
                    : 'INSERT INTO vms (name, owner, created_by, access_users) VALUES ($1, $2, $3, $4) ON CONFLICT (name) DO NOTHING RETURNING *'
            const result = await run(query, organizationId
                ? [name, owner, created_by, JSON.stringify(access_users ?? []), organizationId]
                : [name, owner, created_by, JSON.stringify(access_users ?? [])])
            if (!result.rows.length) {
                if (organizationId) {
                    const organizationAccess = await run(`
                        SELECT 1 FROM organizations o
                        JOIN organization_members m ON m.organization_id = o.id
                        WHERE o.id = $1 AND o.status = 'active' AND m.user_id = $2
                          AND m.status = 'active' AND m.role IN ('owner', 'admin')
                        LIMIT 1
                    `, [organizationId, actorId])
                    if (!organizationAccess.rows[0]) return res.status(403).send({ error: 'An organization owner or admin must create VMs.' })
                }
                return res.status(409).send({ error: 'VM already exists' })
            }

            const assignedVm = await run('UPDATE vms SET primary_host = $2 WHERE name = $1 RETURNING *', [name, config.vm_host_id])
            if (!assignedVm.rows[0]) throw new Error('VM primary host assignment did not update the new VM.')
            if (body.provision_local !== false && provisionOptions.services?.includes('website')) await ensureWebsitePublicRoute(name, actorId || created_by)
            if (body.provision_local !== false) queueVmProvision(name, config.vm_host_id, provisionOptions, [owner, created_by, ...(access_users ?? [])])

            await recordSystemEvent(req, {
                actionType: 'vm.created',
                actorId,
                targetType: 'vm',
                targetId: name,
                organizationId,
                context: {
                    owner,
                    creator: created_by,
                    accessUsers: access_users ?? [],
                    setup: {
                        operatingSystem: provisionOptions.os,
                        resources: provisionOptions.resources,
                        services: provisionOptions.services,
                        ...(provisionOptions.minecraftServerType ? { minecraftServerType: provisionOptions.minecraftServerType } : {}),
                        minecraftEulaAccepted: provisionOptions.minecraftEulaAccepted,
                    },
                    ...(organizationId ? { organizationId } : {}),
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

async function ensureWebsitePublicRoute(vmName: string, createdBy: string) {
    const existing = await run('SELECT 1 FROM vm_public_ports WHERE vm_name = $1 AND route_type = $2 LIMIT 1', [vmName, 'http'])
    if (existing.rows.length) return
    const routeName = `site-${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`
    await run('INSERT INTO vm_public_ports (vm_name, name, route_type, guest_port, created_by) VALUES ($1, $2, $3, $4, $5)', [vmName, routeName, 'http', 80, createdBy])
}

function queueVmProvision(name: string, host: string, options: VmProvisionOptions, userIds: string[]) {
    void provisionVmOnHost(host, name, internalHostFetch, options).then(async () => {
        await syncUserCertificatesToVm({ vmName: name, userIds }).catch(error => {
            void recordVmProvisioningError(name, error, 'certificate_sync')
        })
    }).catch(error => void recordVmProvisioningError(name, error, 'create_or_provision'))
}

function normalizeProvisionOptions(os: unknown, resources: unknown, services: unknown, minecraftEulaAccepted: unknown, minecraftServerType: unknown, website: unknown): VmProvisionOptions | null {
    const supportedOs = new Set(['ubuntu-24.04', 'ubuntu-26.04', 'ubuntu-22.04'])
    const supportedServices = new Set(['nodejs', 'postgresql', 'redis', 'python', 'bun', 'docker', 'java', 'nginx', 'website', 'minecraft-java'])
    if (os !== undefined && (typeof os !== 'string' || !supportedOs.has(os))) return null
    const resourceOptions = new Set(['1:2GiB', '2:4GiB', '4:8GiB'])
    if (resources !== undefined && (!resources || typeof resources !== 'object' || !('cpu' in resources) || !('memory' in resources)
        || typeof resources.cpu !== 'string' || typeof resources.memory !== 'string' || !resourceOptions.has(`${resources.cpu}:${resources.memory}`))) return null
    if (services !== undefined && (!Array.isArray(services) || services.length > supportedServices.size || services.some(service => typeof service !== 'string' || !supportedServices.has(service)))) return null
    const selectedServices = [...new Set((services || []) as NonNullable<VmProvisionOptions['services']>)]
    if (selectedServices.includes('minecraft-java') !== (minecraftEulaAccepted === true)) return null
    const selectedResources = (resources || { cpu: '1', memory: '2GiB' }) as NonNullable<VmProvisionOptions['resources']>
    if (selectedServices.includes('minecraft-java') && selectedResources.memory === '2GiB') return null
    const supportedMinecraftTypes = new Set(['PAPER', 'VANILLA', 'FABRIC', 'QUILT', 'NEOFORGE', 'PURPUR', 'FOLIA'])
    if (minecraftServerType !== undefined && (typeof minecraftServerType !== 'string' || !supportedMinecraftTypes.has(minecraftServerType))) return null
    if (minecraftServerType !== undefined && !selectedServices.includes('minecraft-java')) return null
    if (website !== undefined && website !== null && !isWebsitePlan(website)) return null
    if (website && !selectedServices.includes('website')) return null
    const selectedOs = (os || 'ubuntu-24.04') as VmProvisionOptions['os']
    return {
        os: selectedOs,
        resources: selectedResources,
        services: selectedServices,
        minecraftEulaAccepted: minecraftEulaAccepted === true,
        ...(selectedServices.includes('minecraft-java') ? { minecraftServerType: (minecraftServerType || 'PAPER') as NonNullable<VmProvisionOptions['minecraftServerType']> } : {}),
        ...(website ? { websiteHtml: renderWebsite(website) } : {}),
    }
}

function isWebsitePlan(value: unknown): value is { title: string, tagline: string, sections: Array<{ heading: string, body: string }> } {
    if (!value || typeof value !== 'object') return false
    const plan = value as Record<string, unknown>
    return typeof plan.title === 'string' && plan.title.trim().length > 0 && plan.title.length <= 120
        && typeof plan.tagline === 'string' && plan.tagline.length <= 120
        && Array.isArray(plan.sections) && plan.sections.length <= 5
        && plan.sections.every(section => Boolean(section) && typeof section === 'object'
            && typeof (section as Record<string, unknown>).heading === 'string'
            && ((section as Record<string, unknown>).heading as string).length <= 100
            && typeof (section as Record<string, unknown>).body === 'string'
            && ((section as Record<string, unknown>).body as string).length <= 500)
}

function escapeHtml(value: string) {
    const entities: Record<string, string> = {
        '&': '&amp;', '<': '&lt;', '>': '&gt;',
        [String.fromCharCode(34)]: '&quot;', [String.fromCharCode(39)]: '&#39;',
    }
    return value.replace(/[&<>"']/g, character => entities[character])
}

function renderWebsite(plan: { title: string, tagline: string, sections: Array<{ heading: string, body: string }> }) {
    const sections = plan.sections.map(section => `<section><h2>${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.body)}</p></section>`).join('\n')
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(plan.tagline)}">
  <title>${escapeHtml(plan.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f7f5f0; color: #20241f; font: 16px/1.65 system-ui, sans-serif; }
    main { width: min(calc(100% - 40px), 900px); margin: clamp(48px, 12vh, 120px) auto; }
    header { padding: clamp(24px, 7vw, 64px); border-radius: 28px; background: #e9e6dc; }
    h1 { max-width: 15ch; margin: 0; font-size: clamp(2.5rem, 9vw, 6rem); line-height: .98; letter-spacing: -.06em; }
    header p { max-width: 52ch; color: #62685f; font-size: 1.12rem; }
    section { padding: 28px 8px; border-bottom: 1px solid #d8d7cf; }
    h2 { margin: 0 0 8px; font-size: 1.3rem; letter-spacing: -.02em; }
    section p { max-width: 68ch; margin: 0; color: #555c56; }
  </style>
</head>
<body><main><header><h1>${escapeHtml(plan.title)}</h1><p>${escapeHtml(plan.tagline)}</p></header>
${sections}
</main></body>
</html>`
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
