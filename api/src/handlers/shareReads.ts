import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { requestedContentOrganization, requireContentOrganization } from '#utils/contentOrganization.ts'
import { authenticatedUser, buildTree, findShare, listSharesForRoot, toShare, type ShareRow } from './shareData.ts'

export async function getShare(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    const share = await findShare(id)
    if (!share) return res.status(404).send({ error: 'Share not found.' })
    return res.send(toShare(share))
}

export async function getShareTree(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    const root = await findShare(id)
    if (!root) return res.status(404).send({ error: 'Share not found.' })
    const rows = await listSharesForRoot(root)
    return res.send(buildTree(rows, root.id))
}

export async function getUserShares(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    const auth = await authenticatedUser(req)
    if (!auth || auth !== id) return res.status(401).send({ error: 'Unauthorized.' })
    const organizationId = requestedContentOrganization(req)
    if (!await requireContentOrganization(req, res, organizationId)) return
    const result = await run(`
        SELECT * FROM share
        WHERE (($2::text IS NULL AND organization_id IS NULL AND owner = $1) OR organization_id = $2)
          AND COALESCE(parent, '') = ''
        ORDER BY updated_at DESC
        LIMIT 100
    `, [id, organizationId])
    return res.send(result.rows.map(row => toShare(row as ShareRow)))
}

export async function getUserProjects(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    const auth = await authenticatedUser(req)
    if (!auth || auth !== id) return res.status(401).send({ error: 'Unauthorized.' })
    const organizationId = requestedContentOrganization(req)
    if (!await requireContentOrganization(req, res, organizationId)) return

    const result = await run(`
        WITH RECURSIVE roots AS (
            SELECT *
            FROM share
            WHERE (($2::text IS NULL AND organization_id IS NULL AND owner = $1) OR organization_id = $2)
              AND COALESCE(parent, '') = ''
            ORDER BY updated_at DESC
            LIMIT 100
        ),
        tree(root_id, id, owner, content, organization_id) AS (
            SELECT id, id, owner, content, organization_id
            FROM roots
            UNION ALL
            SELECT tree.root_id, child.id, child.owner, child.content, child.organization_id
            FROM share child
            JOIN tree ON child.parent = tree.id
              AND child.organization_id IS NOT DISTINCT FROM tree.organization_id
        )
        SELECT
            COALESCE(NULLIF(root.alias, ''), root.id) AS alias,
            root.owner,
            root.updated_at AS last_updated,
            COUNT(tree.id) AS file_count,
            COALESCE(SUM(LENGTH(tree.content)), 0) AS total_size
        FROM roots root
        JOIN tree ON tree.root_id = root.id
        GROUP BY root.id, root.alias, root.owner, root.updated_at
        ORDER BY root.updated_at DESC
    `, [id, organizationId])

    return res.send(result.rows.map(row => ({
        alias: row.alias,
        owner: row.owner,
        editors: [row.owner],
        file_count: Number(row.file_count || 0),
        total_size: Number(row.total_size || 0),
        last_updated: row.last_updated,
    })))
}

export async function getProject(req: FastifyRequest, res: FastifyReply) {
    const { alias } = req.params as { alias: string }
    const root = await findShare(alias)
    if (!root) return res.status(404).send({ error: 'Project not found.' })

    const auth = await authenticatedUser(req)
    if (root.organization_id && root.owner !== 'anonymous') {
        if (!await requireContentOrganization(req, res, root.organization_id)) return
    } else if (root.owner !== 'anonymous' && auth !== root.owner) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const rows = await listSharesForRoot(root)
    return res.send({
        share: toShare(root),
        tree: buildTree(rows, root.id),
    })
}

