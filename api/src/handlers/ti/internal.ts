import { timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from 'fastify'
import { queryOnce } from '../../utils/db.ts'

type Options = FastifyPluginOptions & { token?: string }

export default async function tiInternalApi(fastify: FastifyInstance, options: Options) {
    const expectedToken = String(options.token ?? process.env.TI_SCRAPER_SERVICE_TOKEN ?? '').trim()
    fastify.addHook('preHandler', async (request, reply) => {
        if (!sameSecret(request.headers['x-hanasand-service-token'], expectedToken)) {
            return reply.code(401).send({ error: 'authentication_required' })
        }
    })

    fastify.get('/organization-context/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const id = request.params.id.trim()
        if (!/^[A-Za-z0-9_.:@-]{1,200}$/.test(id)) return reply.code(400).send({ error: 'invalid_organization_id' })
        const [organization] = (await queryOnce(`
            SELECT id, name, slug, status, alert_visibility_policy, created_by, created_at, updated_at
            FROM organizations WHERE id = $1
        `, [id])).rows as any[]
        if (!organization) return reply.code(404).send({ error: 'organization_not_found' })
        const [members, watchlistItems, destinations] = await Promise.all([
            queryOnce(`
                SELECT member.user_id, member.role, member.status, member.created_at, users.active AS user_active
                FROM organization_members member
                JOIN users ON users.id = member.user_id
                WHERE member.organization_id = $1
            `, [id]),
            queryOnce(`
                SELECT id, kind, value, created_by, updated_by, lifecycle_reason, lifecycle_request_id
                FROM organization_watchlist_items
                WHERE organization_id = $1 AND status = 'active' AND archived_at IS NULL
                ORDER BY id
            `, [id]),
            queryOnce(`
                SELECT id FROM dwm_webhook_destinations
                WHERE org_id = $1 AND status = 'active'
                ORDER BY updated_at DESC, id DESC LIMIT 1
            `, [id]),
        ])
        return {
            organization,
            members: members.rows,
            watchlistItems: watchlistItems.rows,
            destinationId: (destinations.rows[0] as any)?.id ?? null,
        }
    })

    fastify.get('/watchlist-context', async () => {
        const result = await queryOnce(`
            SELECT organization.id AS organization_id,
                organization.status AS organization_status,
                organization.alert_visibility_policy,
                item.id AS watchlist_item_id, item.kind, item.value, item.created_by, item.updated_by,
                item.lifecycle_reason, item.lifecycle_request_id,
                destination.id AS destination_id
            FROM organizations organization
            JOIN organization_watchlist_items item
              ON item.organization_id = organization.id
             AND item.status = 'active' AND item.archived_at IS NULL
            LEFT JOIN LATERAL (
                SELECT id FROM dwm_webhook_destinations
                WHERE org_id = organization.id AND status = 'active'
                ORDER BY updated_at DESC, id DESC LIMIT 1
            ) destination ON true
            WHERE organization.status = 'active'
            ORDER BY organization.id, item.id
        `)
        return { items: result.rows }
    })
}

function sameSecret(presented: string | string[] | undefined, expected: string) {
    const left = Buffer.from(Array.isArray(presented) ? presented[0] ?? '' : presented ?? '')
    const right = Buffer.from(expected)
    return Boolean(expected) && left.length === right.length && timingSafeEqual(left, right)
}
