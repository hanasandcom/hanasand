import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'
import { contentOrganizationAccess, requestedContentOrganization } from '#utils/contentOrganization.ts'

export async function vmViewer(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) { res.status(401).send({ error: 'Unauthorized.' }); return null }
    const { valid: admin } = await hasHanasandInternalRouteAccess(req)
    return { id, admin }
}

export async function requireVmAccess(req: FastifyRequest, res: FastifyReply, name: string, allowDeleted = false, manage = false) {
    const viewer = await vmViewer(req, res)
    if (!viewer) return null
    const result = await run('SELECT name, owner, created_by, access_users, organization_id, deleted_at FROM vms WHERE LOWER(name) = LOWER($1) LIMIT 1', [name])
    const vm = result.rows[0]
    if (!vm) {
        res.status(404).send({ error: 'VM not found.' }); return null
    }
    const organizationId = requestedContentOrganization(req)
    if (organizationId) {
        if (!await contentOrganizationAccess(organizationId, viewer.id)) {
            res.status(403).send({ error: 'You do not have access to this organization’s content.' }); return null
        }
    }
    if ((vm.organization_id ?? null) !== organizationId) {
        res.status(404).send({ error: 'VM not found.' }); return null
    }
    const canAccess = await canAccessVm(vm.name, viewer.id, { isAdmin: viewer.admin, manage })
    if (!canAccess) {
        res.status(404).send({ error: 'VM not found.' }); return null
    }
    if (vm.deleted_at && !allowDeleted) { res.status(409).send({ error: 'This VM is scheduled for deletion. Restore it before connecting.' }); return null }
    return { ...viewer, name: vm.name as string }
}

export async function hasVmAccess(name: string, userId: string, manage = false) {
    const result = await run(manage ? 'SELECT vm_user_can_manage($1, $2) AS allowed' : 'SELECT vm_user_has_access($1, $2) AS allowed', [name, userId])
    return result.rows[0]?.allowed === true
}

export async function canAccessVm(name: string, userId: string, options: { isAdmin: boolean, manage?: boolean }) {
    return options.isAdmin || await hasVmAccess(name, userId, options.manage)
}
