import type { FastifyReply, FastifyRequest } from 'fastify'
import { organizationPrivacyDeletionInProgress } from '#utils/organizationLifecycle.ts'
import { roleCanManageOrganization, type OrganizationRole, type OrganizationRow } from '#utils/organizations.ts'
import { logOrganizationEvent } from './audit.ts'

export function inactiveOrganizationMutationBlocker(organization: Pick<OrganizationRow, 'id' | 'status'>, action: string) {
    const status = organization.status ?? 'active'
    if (status !== 'archived' && status !== 'deleted') return null

    return {
        schemaVersion: 'organization.lifecycle_mutation_blocker.v1',
        organizationId: organization.id,
        tenantId: organization.id,
        status,
        code: status === 'deleted' ? 'org_deleted' : 'org_archived',
        action,
        message: `Organization is ${status}; reactivate it before ${action}.`,
    }
}

export function privacyDeletionMutationBlocker(organization: Pick<OrganizationRow, 'id' | 'status' | 'audit_safe_metadata'>, action: string) {
    if (!organizationPrivacyDeletionInProgress(organization)) return null
    return {
        schemaVersion: 'organization.lifecycle_mutation_blocker.v1' as const,
        organizationId: organization.id,
        tenantId: organization.id,
        status: 'archived' as const,
        code: 'org_archived' as const,
        action,
        message: 'Organization deletion is in progress; writes are blocked.',
    }
}

export function sendOrganizationLifecycleBlocker(
    req: FastifyRequest,
    res: FastifyReply,
    blocker: NonNullable<ReturnType<typeof inactiveOrganizationMutationBlocker>>,
    actorId: string,
    actorRole: OrganizationRole | undefined,
) {
    const serviceLogAction = 'organization_lifecycle_mutation_blocked'
    const body = req.body as { requestId?: unknown, request_id?: unknown, reason?: unknown } | undefined
    const requestId = typeof body?.requestId === 'string'
        ? body.requestId
        : typeof body?.request_id === 'string'
            ? body.request_id
            : null
    const reason = typeof body?.reason === 'string' && body.reason.trim()
        ? body.reason.trim().slice(0, 1000)
        : null
    logOrganizationEvent(req, serviceLogAction, blocker.organizationId, actorId, {
        requestId,
        reason,
        actorRole: actorRole ?? null,
        blockedAction: blocker.action,
        lifecycleStatus: blocker.status,
        blockerCode: blocker.code,
    })

    return res.status(409).send({
        error: blocker.message,
        lifecycleBlocker: { ...blocker, serviceLogAction, requestId },
        auditEvent: {
            schemaVersion: 'organization.lifecycle_mutation_blocker_audit.v1',
            organizationId: blocker.organizationId,
            tenantId: blocker.tenantId,
            actorId,
            actorRole: actorRole ?? null,
            serviceLogAction,
            requestId,
            blockedAction: blocker.action,
            blockerCode: blocker.code,
            lifecycleStatus: blocker.status,
        },
    })
}

export function organizationSettingsPermissions(role: OrganizationRole | undefined) {
    const canEdit = roleCanManageOrganization(role)
    return {
        canEdit,
        editableFields: canEdit ? ['name', 'slug', 'defaultWebhookPolicy', 'alertVisibilityPolicy', 'retentionDays', 'auditSafeMetadata'] : [],
    }
}
