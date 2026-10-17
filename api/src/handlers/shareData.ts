import type { FastifyRequest } from 'fastify'
import run from '#db'
import { validateSession } from '#utils/auth/session.ts'

export type ShareRow = {
    id: string
    path: string
    content: string
    git: string | null
    locked: boolean
    owner: string
    organization_id: string | null
    parent: string
    alias: string
    type: 'file' | 'folder'
    created_at: string
    updated_at: string
}

export type ShareInput = {
    id?: string
    path?: string
    name?: string
    content?: string
    parent?: string
    type?: string
    includeTree?: boolean
}

export type ShareTreeItem = {
    id: string
    name: string
    alias: string | null
    parent: string | null
} & ({
    type: 'file'
} | {
    type: 'folder'
    children: ShareTreeItem[]
})

export async function authenticatedUser(req: FastifyRequest) {
    const token = headerValue(req.headers.authorization)?.replace(/^Bearer\s+/i, '')
    const id = headerValue(req.headers.id)
    if (!token || !id) return null
    const session = await validateSession({ id, token }).catch(() => null)
    return session?.user.id || null
}

export async function findShare(id: string) {
    const result = await run('SELECT * FROM share WHERE id = $1 OR alias = $1 OR path = $1 LIMIT 1', [id])
    return result.rows[0] as ShareRow | undefined
}

export async function deleteShareTree(id: string) {
    await run(`
        WITH RECURSIVE descendants AS (
            SELECT id, organization_id
            FROM share
            WHERE id = $1
            UNION ALL
            SELECT child.id, child.organization_id
            FROM share child
            JOIN descendants ON child.parent = descendants.id
              AND child.organization_id IS NOT DISTINCT FROM descendants.organization_id
        )
        DELETE FROM share
        WHERE id IN (SELECT id FROM descendants)
    `, [id])
}

export async function listSharesForRoot(root: ShareRow) {
    const result = await run(`SELECT * FROM share WHERE
        (organization_id IS NULL AND $2::text IS NULL AND owner = $1) OR organization_id = $2
        ORDER BY parent ASC, type DESC, path ASC`, [root.owner, root.organization_id])
    const rows = result.rows as ShareRow[]
    const descendants = new Set([root.id])
    let changed = true
    while (changed) {
        changed = false
        for (const row of rows) {
            if (row.parent && descendants.has(row.parent) && !descendants.has(row.id)) {
                descendants.add(row.id)
                changed = true
            }
        }
    }
    return rows.filter(row => descendants.has(row.id))
}

export function buildTree(rows: ShareRow[], rootId: string) {
    const childrenByParent = new Map<string, ShareRow[]>()
    for (const row of rows) {
        const parent = row.parent || ''
        const children = childrenByParent.get(parent) || []
        children.push(row)
        childrenByParent.set(parent, children)
    }
    const toItem = (row: ShareRow): ShareTreeItem => row.type === 'folder'
        ? { id: row.id, name: row.path, alias: row.alias, parent: row.parent || null, type: 'folder', children: (childrenByParent.get(row.id) || []).map(toItem) }
        : { id: row.id, name: row.path, alias: row.alias, parent: row.parent || null, type: 'file' }
    const root = rows.find(row => row.id === rootId)
    return root ? [toItem(root)] : []
}

export function toShare(row: ShareRow) {
    const words = row.content.trim() ? row.content.trim().split(/\s+/).length : 0
    return {
        id: row.id,
        path: row.path,
        content: row.content,
        wordCount: words,
        estimatedMinutes: Math.max(1, Math.ceil(words / 200)),
        timestamp: row.updated_at || row.created_at,
        git: row.git,
        locked: row.locked,
        owner: row.owner,
        organization_id: row.organization_id,
        parent: row.parent || '',
        alias: row.alias,
        type: row.type,
    }
}

export function cleanId(value?: string) {
    return (value || '').trim().replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120)
}

export function cleanAlias(value: string) {
    return cleanId(value).toLowerCase()
}

function headerValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value
}
