import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { requestedContentOrganization, requireContentOrganization } from '#utils/contentOrganization.ts'
import { authenticatedUser, buildTree, cleanAlias, cleanId, deleteShareTree, findShare, listSharesForRoot, toShare, type ShareInput, type ShareRow } from './shareData.ts'

export async function postShare(req: FastifyRequest, res: FastifyReply) {
    const body = req.body as ShareInput ?? {}
    const id = cleanId(body.id || body.path || body.name)
    if (!id) return res.status(400).send({ error: 'Missing share id.' })
    const owner = await authenticatedUser(req) || 'anonymous'
    const type = body.type === 'folder' ? 'folder' : 'file'
    const path = body.path || body.name || id
    const alias = cleanAlias(body.name || body.path || id)
    const parent = body.parent || ''
    const existing = await findShare(id)
    const parentShare = parent ? await findShare(parent) : undefined
    if (parent && !parentShare) return res.status(404).send({ error: 'Parent share not found.' })
    const organizationId = existing?.organization_id ?? parentShare?.organization_id ?? requestedContentOrganization(req)
    if (existing && (existing.organization_id || null) !== (organizationId || null)) return res.status(409).send({ error: 'Share already belongs to another workspace.' })
    if (parentShare && (parentShare.organization_id || null) !== (organizationId || null)) return res.status(409).send({ error: 'Parent belongs to another workspace.' })
    if (!await requireContentOrganization(req, res, organizationId, true)) return
    const content = typeof body.content === 'string' ? body.content : null
    const result = await run(`
        INSERT INTO share (id, path, content, owner, parent, alias, type, organization_id, updated_at)
        VALUES ($1, $2, COALESCE($3, ''), $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (id) DO UPDATE SET
            path = EXCLUDED.path,
            content = COALESCE($3, share.content),
            owner = COALESCE(NULLIF(share.owner, ''), EXCLUDED.owner),
            parent = EXCLUDED.parent,
            alias = EXCLUDED.alias,
            type = EXCLUDED.type,
            updated_at = NOW()
        WHERE share.organization_id IS NOT DISTINCT FROM $8
        RETURNING *
    `, [id, path, content, owner, parent, alias, type, organizationId])
    if (!result.rows.length) return res.status(409).send({ error: 'Share ownership changed. Reload and try again.' })
    const share = result.rows[0] as ShareRow
    if (body.includeTree) {
        const rows = await listSharesForRoot(share)
        return res.status(201).send({ ...toShare(share), tree: buildTree(rows, share.id) })
    }
    return res.status(201).send(toShare(share))
}

export async function putShare(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    const body = req.body as Partial<ShareInput & { locked?: boolean, alias?: string }> ?? {}
    const existing = await findShare(id)
    if (!existing) return res.status(404).send({ error: 'Share not found.' })
    if (!await requireContentOrganization(req, res, existing.organization_id, true)) return
    if (body.parent) {
        const parent = await findShare(body.parent)
        if (!parent || parent.organization_id !== existing.organization_id) return res.status(409).send({ error: 'Parent belongs to another workspace.' })
    }
    const result = await run(`
        UPDATE share
        SET path = COALESCE($2, path),
            content = COALESCE($3, content),
            parent = COALESCE($4, parent),
            alias = COALESCE($5, alias),
            type = COALESCE($6, type),
            locked = COALESCE($7, locked),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
    `, [
        id,
        body.path || body.name || null,
        typeof body.content === 'string' ? body.content : null,
        body.parent ?? null,
        body.alias || (body.name || body.path ? cleanAlias(body.name || body.path || id) : null),
        body.type === 'folder' || body.type === 'file' ? body.type : null,
        typeof body.locked === 'boolean' ? body.locked : null,
    ])
    return res.send(toShare(result.rows[0] as ShareRow))
}

export async function deleteShare(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    const existing = await findShare(id)
    if (!existing) return res.status(404).send({ error: 'Share not found.' })
    if (!await requireContentOrganization(req, res, existing.organization_id, true)) return
    await deleteShareTree(id)
    return res.send({ deleted: id })
}

export async function deleteProject(req: FastifyRequest, res: FastifyReply) {
    const { alias } = req.params as { alias: string }
    const root = await findShare(alias)
    if (!root) return res.status(404).send({ error: 'Project not found.' })

    const auth = await authenticatedUser(req)
    if (root.organization_id) {
        if (!await requireContentOrganization(req, res, root.organization_id, true)) return
    } else if (!auth || auth !== root.owner) return res.status(401).send({ error: 'Unauthorized.' })

    await deleteShareTree(root.id)
    return res.send({ deleted: root.alias || root.id })
}

export async function setShareLock(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    const { locked } = (req.body || {}) as { locked?: unknown }
    if (typeof locked !== 'boolean') return res.status(400).send({ error: 'A boolean locked value is required.' })
    const existing = await findShare(id)
    if (!existing) return res.status(404).send({ error: 'Share not found.' })
    if (!await requireContentOrganization(req, res, existing.organization_id, true)) return
    const result = await run('UPDATE share SET locked = $2, updated_at = NOW() WHERE id = $1 RETURNING *', [id, locked])
    const share = result.rows[0] as ShareRow | undefined
    if (!share) return res.status(404).send({ error: 'Share not found.' })
    return res.send(toShare(share))
}

