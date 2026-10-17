import type { LatestDeploymentRow, LatestReleaseRow, LatestVerificationJobRow, ReadinessStatus } from './types.ts'

export function readinessItem({ id, priority, label, status, evidence, action, owner, control, lastAttempt, measurable }: {
    id: string
    priority: number
    label: string
    status: ReadinessStatus
    evidence: string[]
    action: string
    owner: string
    control: string
    lastAttempt: string
    measurable: boolean
}) {
    return {
        id,
        priority,
        label,
        status,
        evidence,
        action,
        owner,
        control,
        lastAttempt,
        measurable,
    }
}

export function readinessStatus(isOperational: boolean, hasEvidence: boolean): ReadinessStatus {
    if (isOperational) return 'operational'
    return hasEvidence ? 'evidence_gap' : 'internal_action'
}

export function latestAttempt(rows: LatestVerificationJobRow[]) {
    return rows.reduce<LatestVerificationJobRow | undefined>((latest, row) => {
        if (!latest) return row
        return new Date(row.updated_at).getTime() > new Date(latest.updated_at).getTime() ? row : latest
    }, undefined)
}

export function formatVerificationAttempt(row?: LatestVerificationJobRow) {
    if (!row) {
        return 'No durable verification job attempt is recorded for this owner.'
    }
    const finishedAt = row.completed_at || row.cancelled_at || row.updated_at
    const detail = row.error ? `; ${row.error.slice(0, 160)}` : ''
    return `${row.kind} job ${row.id} is ${row.status} (${row.current_step}) at ${finishedAt}${detail}.`
}

export function formatDeploymentAttempt(deployment?: LatestDeploymentRow, release?: LatestReleaseRow) {
    if (!deployment && !release) {
        return 'No deployment or release attempt is recorded for this owner.'
    }
    const deploymentPart = deployment
        ? `deployment ${deployment.id} is ${deployment.status} on ${deployment.vm_name}/${deployment.service_name} at ${deployment.completed_at || deployment.updated_at}`
        : 'no deployment record'
    const releasePart = release
        ? `release ${release.id} is ${release.status}${release.deployment_id ? ` linked to ${release.deployment_id}` : ''} at ${release.updated_at}`
        : 'no release record'
    const failure = deployment?.failure_reason ? `; ${deployment.failure_reason.slice(0, 160)}` : ''
    return `${deploymentPart}; ${releasePart}${failure}.`
}
export function formatNumber(value: number) {
    return Number.isFinite(value) ? value.toFixed(value >= 10 ? 1 : 2) : '0'
}

export function formatDeploymentWindow(total: number, recent: number, noun = 'deployment record') {
    const totalLabel = formatCountLabel(total, noun)
    return recent > 0
        ? `${totalLabel}, ${formatCountLabel(recent, noun)} in this usage window`
        : `${totalLabel}, most recent activity is outside this usage window`
}

export function countPhrase(value: number, phrase: string) {
    return value > 0 ? `${value} ${phrase}` : null
}

export function formatEvidenceParts(parts: Array<string | null>, fallback: string) {
    const visibleParts = parts.filter((part): part is string => Boolean(part))
    if (!visibleParts.length) {
        return fallback
    }
    return visibleParts.join('; ')
}

export function formatCountLabel(value: number, singular: string) {
    if (value === 0) return `no ${singular}s`
    return `${value} ${singular}${value === 1 ? '' : 's'}`
}
