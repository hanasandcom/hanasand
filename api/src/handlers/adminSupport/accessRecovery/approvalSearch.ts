import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { requireAdminSupport } from '../auth.ts'
import { normalizeApprovalStatus, normalizeOption, supportText as text } from '#utils/support/adminSupportInput.ts'
import { toAccessRecoveryDecision } from '../cases/accessRecoveryApprovalMapping.ts'
import { supportAccessRecoveryApprovalTimeline } from '../cases/accessRecoveryApprovalTimeline.ts'
import { supportAccessRecoveryApprovalSelect } from './approvalQuery.ts'
import type { AccessRecoveryApprovalRow } from '../supportTypes.ts'

type AccessRecoveryApprovalQuery = {
    request?: string
    requestId?: string
    org?: string
    orgId?: string
    status?: string
    outcome?: string
    requester?: string
    requestedBy?: string
    approver?: string
    approvedBy?: string
    from?: string
    to?: string
    limit?: string
}

export async function getSupportAccessRecoveryApprovals(
    req: FastifyRequest<{ Querystring: AccessRecoveryApprovalQuery }>,
    res: FastifyReply,
) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const query = req.query as AccessRecoveryApprovalQuery
    const where: string[] = []
    const values: Array<string | number | Date | null> = []
    const add = (value: string | number | Date | null) => {
        values.push(value)
        return `$${values.length}`
    }

    const request = text(query.request || query.requestId)
    const org = text(query.org || query.orgId)
    const status = normalizeApprovalStatus(query.status)
    const outcome = normalizeOption(query.outcome, ['success', 'denied', 'failed'])
    const requester = text(query.requester || query.requestedBy)
    const approver = text(query.approver || query.approvedBy)
    const from = text(query.from)
    const to = text(query.to)
    const parsedLimit = Number(query.limit || 100)
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 250) : 100

    if (request) where.push(`approval.request_id ILIKE ${add(`%${request}%`)}`)
    if (org) {
        const placeholder = add(`%${org}%`)
        where.push('(approval.organization_id ILIKE ' + placeholder + ' OR organization.name ILIKE ' + placeholder + ' OR organization.slug ILIKE ' + placeholder + ')')
    }
    if (status) where.push(`approval.status = ${add(status)}`)
    if (outcome) where.push(`approval.outcome = ${add(outcome)}`)
    if (requester) where.push(`approval.requested_by ILIKE ${add(`%${requester}%`)}`)
    if (approver) {
        const placeholder = add(`%${approver}%`)
        where.push('(approval.approved_by ILIKE ' + placeholder + ' OR approval.denied_by ILIKE ' + placeholder + ')')
    }
    if (from && !Number.isNaN(Date.parse(from))) where.push(`approval.created_at >= ${add(new Date(from).toISOString())}`)
    if (to && !Number.isNaN(Date.parse(to))) where.push(`approval.created_at <= ${add(new Date(to).toISOString())}`)

    const result = await run(`${supportAccessRecoveryApprovalSelect(true)}
        ${where.length ? `WHERE ${where.join('\n          AND ')}` : ''}
        ORDER BY approval.updated_at DESC, approval.created_at DESC
        LIMIT ${add(limit)}
    `, values)

    const approvals = (result.rows as AccessRecoveryApprovalRow[]).map(toAccessRecoveryDecision)
    const filters = { request, org, status, outcome, requester, approver, from, to, limit }
    const approvalTimeline = supportAccessRecoveryApprovalTimeline(filters, approvals)
    return res.send({
        approvals,
        filters,
        detail: {
            schemaVersion: 'support.access_recovery.approval_search.v1',
            generatedAt: new Date().toISOString(),
            filters,
            approvalTimeline,
            copyText: approvals.slice(0, 20).map(approval => approval.copyText).join('\n\n'),
        },
    })
}
