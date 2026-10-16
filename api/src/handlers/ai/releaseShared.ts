import { buildAiPreviewUrl } from '#utils/ai/preview.ts'

export type ReleaseRow = {
    id: string
    owner_id: string
    conversation_id: string
    deployment_id: string | null
    vm_name: string
    stack_type: AIStackType
    access_policy: AIDeploymentAccessPolicy
    status: AIReleaseStatus
    preview_url: string | null
    created_by: string | null
    created_at: string
    updated_at: string
    notes: string | null
}

type ReleaseTrustInput = ReleaseRow & {
    events?: AIDeploymentEvent[] | null
}

export function toReleaseBase(row: ReleaseRow): Omit<AIRelease, 'trust'> {
    return {
        id: row.id,
        ownerId: row.owner_id,
        conversationId: row.conversation_id,
        deploymentId: row.deployment_id,
        vmName: row.vm_name,
        stackType: row.stack_type,
        accessPolicy: row.access_policy,
        status: row.status,
        previewUrl: row.deployment_id ? buildAiPreviewUrl(row.deployment_id) : row.preview_url,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        notes: row.notes,
    }
}

export function toRelease(row: ReleaseTrustInput): AIRelease & { trust: AIReleaseTrust } {
    return {
        ...toReleaseBase(row),
        trust: releaseTrust(row),
    }
}

function releaseTrust(row: ReleaseTrustInput): AIReleaseTrust {
    const requestIds = releaseRequestIds(row.events || [])
    const previewUrl = row.deployment_id ? buildAiPreviewUrl(row.deployment_id) : row.preview_url
    const bundleUrl = `/api/ai/releases/${row.id}/support-bundle`

    return {
        versionHistory: {
            releaseId: row.id,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            summary: row.status === 'current'
                ? 'This is the current release record for the AI-built project.'
                : `This release is kept as a recoverable ${row.status.replaceAll('_', ' ')} history point.`,
        },
        recovery: {
            rollbackAvailable: row.status !== 'current' && row.status !== 'rollback_target',
            rollbackLabel: row.status === 'rollback_target' ? 'Rollback target selected' : 'Rollback to this release',
            backupBeforeRiskyChanges: true,
            backupPolicy: 'Before destructive or production-impacting AI changes, create a checkpoint or release record so the project can be restored.',
        },
        exports: {
            zipAvailable: true,
            githubAvailable: true,
            zipLabel: 'Export project as zip from the workspace files.',
            githubLabel: 'Push or mirror the project to GitHub from the repository workspace.',
        },
        launchReport: [
            `Release ${row.id} on ${row.vm_name}.`,
            `Stack: ${row.stack_type.replaceAll('_', ' ')}.`,
            `Access: ${row.access_policy.replaceAll('_', ' ')}.`,
            previewUrl ? `Preview: ${previewUrl}.` : 'Preview URL was not recorded.',
            row.notes ? `Notes: ${row.notes}` : 'No release notes recorded.',
        ],
        noLockIn: {
            headline: 'Your code, your domain, your infrastructure.',
            bullets: [
                'Source stays exportable as files or Git history.',
                'Deployments are recorded against your VM/domain choices.',
                'Rollback and support evidence stay attached to release history.',
            ],
        },
        supportBundle: {
            available: true,
            url: bundleUrl,
            includes: ['release metadata', 'deployment events', 'failure reason', 'request IDs', 'launch report', 'rollback status'],
            requestIds,
        },
        sla: [
            { tier: 'Starter', promise: 'Async queue, basic deploy history, and recoverable release records.' },
            { tier: 'Pro', promise: 'Priority verification, rollback target selection, custom domain readiness, and support bundles.' },
            { tier: 'Agency', promise: 'Client reports, white-label deploy evidence, and multi-workspace history.' },
            { tier: 'Business', promise: 'Audit logs, approvals, scoped secrets, release evidence, and SSO later.' },
        ],
    }
}

function releaseRequestIds(events: AIDeploymentEvent[]) {
    return [...new Set(events.flatMap((event) => {
        const text = `${event.message || ''} ${event.stage || ''}`
        return [...text.matchAll(/\b(?:request[_ -]?id|x-request-id)[:= ]+([a-z0-9_.:-]{6,})/gi)].map((match) => match[1])
    }))].slice(0, 12)
}
