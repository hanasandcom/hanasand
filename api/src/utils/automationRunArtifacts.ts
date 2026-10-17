import type { AutomationRunArtifact, AutomationRunRow } from './automationTypes.ts'

export function toAutomationRun(row: AutomationRunRow) {
    const artifacts = normalizeRunArtifacts(row.artifacts)
    return {
        id: row.id,
        automationId: row.automation_id,
        caseNumber: row.issue_id ? `HA-${row.issue_id}` : null,
        ownerId: row.owner_id,
        status: row.status,
        warning: row.warning,
        result: row.result,
        error: row.error,
        provider: row.provider,
        model: row.model,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        durationMs: row.duration_ms,
        artifacts,
        logs: artifacts.filter(artifact => artifact.type === 'log').map(artifact => artifact.href || artifact.text || artifact.label),
        screenshots: artifacts.filter(artifact => artifact.type === 'screenshot').map(artifact => artifact.href || artifact.text || artifact.label),
    }
}

export function runArtifacts(message: string, artifacts: unknown[] = []): AutomationRunArtifact[] {
    return normalizeRunArtifacts([
        { type: 'log', label: 'Run log', text: message },
        ...artifacts,
    ])
}

function normalizeRunArtifacts(value: unknown): AutomationRunArtifact[] {
    const items = Array.isArray(value) ? value : []
    return items.flatMap(item => {
        const record = isRecord(item) ? item : { text: String(item || '') }
        const href = firstString(record.href, record.url, record.path, record.screenshotPath)
        const text = firstString(record.text, record.message, record.content)
        const label = firstString(record.label, record.name, record.title) || (href ? href.split('/').pop() || href : text.slice(0, 80)) || 'Artifact'
        const rawType = firstString(record.type, record.kind)
        const type: AutomationRunArtifact['type'] = rawType === 'screenshot' || rawType === 'log' || rawType === 'link'
            ? rawType
            : /screenshot|image|capture/i.test(`${label} ${href}`) ? 'screenshot' : href ? 'link' : 'log'
        if (!href && !text) return []
        return [{
            type,
            label,
            href: href || null,
            text: text || null,
            createdAt: firstString(record.createdAt, record.created_at, record.at) || new Date().toISOString(),
        }]
    }).slice(0, 20)
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function firstString(...values: unknown[]) {
    return values.find(value => typeof value === 'string' && value.trim()) as string | undefined || ''
}
