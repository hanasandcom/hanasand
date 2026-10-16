export function supportBundleHref(release: AIRelease) {
    return `/api/backend/ai/releases/${encodeURIComponent(release.id)}/support-bundle`
}

export function buildFallbackTrust(release: AIRelease | null): AIReleaseTrust | null {
    if (!release) {
        return null
    }

    return {
        versionHistory: {
            releaseId: release.id,
            status: release.status,
            createdAt: release.createdAt,
            updatedAt: release.updatedAt,
            summary: `Release ${release.id} is kept in project history as ${release.status.replaceAll('_', ' ')}.`,
        },
        recovery: {
            rollbackAvailable: release.status !== 'current' && release.status !== 'rollback_target',
            rollbackLabel: release.status === 'rollback_target' ? 'Rollback target selected' : 'Rollback to this release',
            backupBeforeRiskyChanges: true,
            backupPolicy: 'Create a checkpoint before destructive or production-impacting AI changes.',
        },
        exports: {
            zipAvailable: true,
            githubAvailable: true,
            zipLabel: 'Export project as zip from workspace files.',
            githubLabel: 'Push or mirror the project to GitHub.',
        },
        launchReport: [
            `Release ${release.id} on ${release.vmName}.`,
            `Stack: ${release.stackType.replaceAll('_', ' ')}.`,
            `Access: ${release.accessPolicy.replaceAll('_', ' ')}.`,
            release.previewUrl ? `Preview: ${release.previewUrl}.` : 'Preview URL was not recorded.',
        ],
        noLockIn: {
            headline: 'Your code, your domain, your infrastructure.',
            bullets: ['Source stays exportable.', 'Launches are recorded against your target and domain choices.', 'Rollback details stay attached to launch history.'],
        },
        supportBundle: {
            available: true,
            url: `/api/ai/releases/${release.id}/support-bundle`,
            includes: ['release details', 'launch events', 'failure reason', 'request IDs', 'launch report', 'rollback status'],
            requestIds: [],
        },
        sla: [
            { tier: 'Starter', promise: 'Background review, basic launch history, and recoverable report records.' },
            { tier: 'Pro', promise: 'Priority verification, rollback target selection, and support bundles.' },
            { tier: 'Agency', promise: 'Client reports and multi-workspace history.' },
            { tier: 'Business', promise: 'Audit logs, approvals, scoped secrets, release details, and SSO later.' },
        ],
    }
}
