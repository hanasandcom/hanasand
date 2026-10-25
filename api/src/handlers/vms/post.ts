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
import { enqueueVmProvisionOnHost, waitForVmProvisionOnHost, type VmProvisionOptions } from '#utils/vms/provisionOnHost.ts'
import { provisionLocalLxdInstance } from '#utils/vms/lxd.ts'
import { clearLocalProvisionState, setLocalProvisionState } from '#utils/vms/localProvisionState.ts'
import recordLog from '#utils/logs/recordLog.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { isSupportedSetupService, supportedSetupServices } from '#utils/vms/supportedSetupServices.ts'
import { normalizeUbuntuAptPackages } from '#utils/vms/ubuntuAptPackages.ts'
import { isVmWebsitePlan, renderVmWebsite } from '#utils/vms/website.ts'
import { normalizeNextjsProjectFiles } from '#utils/vms/nextjsProject.ts'
import { minecraftAddonLoader, normalizeMinecraftAddons } from '#utils/vms/minecraftAddons.ts'

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
        minecraft_addons?: unknown
        custom_apt_packages?: unknown
        website?: unknown
        project_files?: unknown
    } ?? {}
    const { name, access_users } = body
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

    const provisionOptions = normalizeProvisionOptions(body.os, body.resources, body.services, body.minecraft_eula_accepted, body.minecraft_server_type, body.minecraft_addons, body.custom_apt_packages, body.website, body.project_files)
    if (!provisionOptions) return res.status(400).send({ error: 'Choose a supported operating system and services.' })
    if (config.lxd_project && provisionOptions.os === 'debian-13') {
        return res.status(400).send({ error: 'This VM host does not support the selected operating system yet.' })
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
                await queueVmProvision(name, existing.primary_host, provisionOptions, [existing.owner, existing.created_by, ...(existing.access_users ?? [])])
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

                if (body.provision_local !== false) await queueVmProvision(name, existing.primary_host, provisionOptions, [nextOwner, nextCreatedBy, ...(nextAccessUsers ?? [])])

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
            if (body.provision_local !== false) await queueVmProvision(name, config.vm_host_id, provisionOptions, [owner, created_by, ...(access_users ?? [])])

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
                        ...(provisionOptions.aptPackages?.length ? { additionalUbuntuPackages: provisionOptions.aptPackages } : {}),
                        ...(provisionOptions.minecraftServerType ? { minecraftServerType: provisionOptions.minecraftServerType } : {}),
                        ...(provisionOptions.minecraftAddons?.length ? { minecraftAddons: provisionOptions.minecraftAddons } : {}),
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
        if (error instanceof VmProvisionQueueError) return res.status(503).send({ error: error.message })
        return res.status(500).send({ error: 'Internal server error' })
    }
}

async function queueVmProvision(name: string, host: string, options: VmProvisionOptions, userIds: string[]) {
    if (config.lxd_project) {
        setLocalProvisionState(name, { status: 'Provisioning', status_reason: 'Preparing the selected VM setup' })
        void provisionLocalLxdInstance(name, options).then(() => {
            clearLocalProvisionState(name)
        }).catch(error => {
            setLocalProvisionState(name, { status: 'Error', status_reason: 'VM setup could not start. Try again or contact Support if the problem persists.' })
            void recordVmProvisioningError(name, error, 'create_or_provision')
        })
        return
    }
    try {
        await enqueueVmProvisionOnHost(host, name, internalHostFetch, options)
    } catch {
        throw new VmProvisionQueueError('The VM host could not start this setup. Try again in a moment.')
    }
    void waitForVmProvisionOnHost(host, name, internalHostFetch).then(async () => {
        await syncUserCertificatesToVm({ vmName: name, userIds }).catch(error => {
            void recordVmProvisioningError(name, error, 'certificate_sync')
        })
    }).catch(error => void recordVmProvisioningError(name, error, 'create_or_provision'))
}

class VmProvisionQueueError extends Error {}

function normalizeProvisionOptions(os: unknown, resources: unknown, services: unknown, minecraftEulaAccepted: unknown, minecraftServerType: unknown, minecraftAddonsInput: unknown, customAptPackages: unknown, website: unknown, projectFilesInput?: unknown): VmProvisionOptions | null {
    const supportedOs = new Set(['ubuntu-24.04', 'ubuntu-26.04', 'ubuntu-22.04', 'ubuntu-24.04-desktop', 'debian-13', 'kali', 'fedora-44', 'almalinux-9', 'rocky-9', 'centos-stream-10'])
    if (os !== undefined && (typeof os !== 'string' || !supportedOs.has(os))) return null
    if (resources !== undefined && !isSupportedResourceAllocation(resources)) return null
    if (services !== undefined && (!Array.isArray(services) || services.length > supportedSetupServices.length || services.some(service => !isSupportedSetupService(service)))) return null
    const selectedAptPackages = normalizeUbuntuAptPackages(customAptPackages)
    if (!selectedAptPackages) return null
    if (['fedora-44', 'almalinux-9', 'rocky-9', 'centos-stream-10'].includes(String(os)) && selectedAptPackages.length) return null
    const selectedServices = [...new Set((services || []) as NonNullable<VmProvisionOptions['services']>)]
    if (selectedServices.includes('minecraft-java') !== (minecraftEulaAccepted === true)) return null
    const selectedResources = (resources || { cpu: '1', memory: '2GiB', disk: '10GiB' }) as NonNullable<VmProvisionOptions['resources']>
    const selectedMinecraftType = (minecraftServerType || 'PAPER') as NonNullable<VmProvisionOptions['minecraftServerType']>
    const selectedMinecraftAddons = normalizeMinecraftAddons(minecraftAddonsInput, selectedMinecraftType)
    if (!selectedMinecraftAddons || (selectedMinecraftAddons.length && !selectedServices.includes('minecraft-java'))
        || (selectedMinecraftAddons.length && !minecraftAddonLoader(selectedMinecraftType))) return null
    const memoryGiB = Number.parseInt(selectedResources.memory, 10)
    const diskGiB = Number.parseInt(selectedResources.disk, 10)
    if (selectedServices.includes('minecraft-java') && ['FABRIC', 'QUILT', 'FORGE', 'NEOFORGE', 'FOLIA'].includes(selectedMinecraftType)
        && (memoryGiB < 4 || diskGiB < 20)) return null
    if (os === 'ubuntu-24.04-desktop' && (memoryGiB < 8 || diskGiB < 40)) return null
    const supportedMinecraftTypes = new Set(['PAPER', 'VANILLA', 'FABRIC', 'QUILT', 'FORGE', 'NEOFORGE', 'PURPUR', 'FOLIA'])
    if (minecraftServerType !== undefined && (typeof minecraftServerType !== 'string' || !supportedMinecraftTypes.has(minecraftServerType))) return null
    if (minecraftServerType !== undefined && !selectedServices.includes('minecraft-java')) return null
    if (website !== undefined && website !== null && !isVmWebsitePlan(website)) return null
    if (website && !selectedServices.includes('website')) return null
    const nextjsProjectFiles = projectFilesInput === undefined ? undefined : normalizeNextjsProjectFiles(projectFilesInput)
    if (projectFilesInput !== undefined && (!nextjsProjectFiles || !selectedServices.includes('nodejs'))) return null
    if (nextjsProjectFiles?.length && (memoryGiB < 4 || diskGiB < 20)) return null
    const selectedOs = (os || 'ubuntu-24.04') as VmProvisionOptions['os']
    return {
        os: selectedOs,
        resources: selectedResources,
        services: selectedServices,
        ...(selectedAptPackages.length ? { aptPackages: selectedAptPackages } : {}),
        minecraftEulaAccepted: minecraftEulaAccepted === true,
        ...(selectedServices.includes('minecraft-java') ? { minecraftServerType: selectedMinecraftType } : {}),
        ...(selectedMinecraftAddons.length ? { minecraftAddons: selectedMinecraftAddons } : {}),
        ...(website ? { websiteHtml: renderVmWebsite(website) } : {}),
        ...(nextjsProjectFiles ? { nextjsProjectFiles } : {}),
    }
}

function isSupportedResourceAllocation(value: unknown): value is NonNullable<VmProvisionOptions['resources']> {
    if (!value || typeof value !== 'object') return false
    const resources = value as Record<string, unknown>
    if (typeof resources.cpu !== 'string' || typeof resources.memory !== 'string' || typeof resources.disk !== 'string') return false
    const key = `${resources.cpu}:${resources.memory}:${resources.disk}`
    if (['1:2GiB:10GiB', '2:4GiB:20GiB', '4:8GiB:40GiB'].includes(key)) return true
    return /^(?:[1-9]|10)$/.test(resources.cpu)
        && /^(?:[1-9]|[1-5][0-9]|6[0-4])GiB$/.test(resources.memory)
        && /^(?:2[0-9]|[3-9][0-9]|100)GiB$/.test(resources.disk)
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
