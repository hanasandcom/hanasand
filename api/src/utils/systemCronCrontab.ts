const BEGIN = '# BEGIN HANASAND MANAGED CRON'
const END = '# END HANASAND MANAGED CRON'

export type ManagedCronEntry = {
    schedule: string
    enabled: boolean
}

export type ManagedCronDefinition = {
    id: string
    name: string
    defaultSchedule: string
    command: string
    legacyCommands?: string[]
}

export function normalizeSchedule(value: unknown) {
    const schedule = String(value || '').trim().replace(/\s+/g, ' ')
    const fields = schedule.split(' ')
    if (fields.length !== 5) {
        throw new Error('Cron schedule must contain exactly five fields.')
    }
    if (!fields.every(field => /^[\d*/,-]+$/.test(field))) {
        throw new Error('Cron schedule contains unsupported characters.')
    }
    return schedule
}

export function parseManagedBlock(crontab: string) {
    const entries = new Map<string, ManagedCronEntry>()
    const block = extractManagedBlock(crontab)
    if (!block) return entries

    let pendingId = ''
    for (const rawLine of block.split('\n')) {
        const line = rawLine.trim()
        const idMatch = line.match(/^#\s*id=([A-Za-z0-9_-]+)/)
        if (idMatch) {
            pendingId = idMatch[1]
            continue
        }
        if (!pendingId || !line) continue
        const enabled = !line.startsWith('#')
        const activeLine = enabled ? line : line.replace(/^#\s*/, '')
        const parts = activeLine.split(/\s+/)
        if (parts.length < 6) continue
        entries.set(pendingId, {
            schedule: parts.slice(0, 5).join(' '),
            enabled,
        })
        pendingId = ''
    }
    return entries
}

export function parseExistingCronEntries(crontab: string, definitions: ManagedCronDefinition[]) {
    const entries = new Map<string, ManagedCronEntry>()
    const managedFreeCrontab = removeManagedBlock(crontab)

    for (const rawLine of managedFreeCrontab.split('\n')) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue

        const parts = line.split(/\s+/)
        if (parts.length < 6) continue

        const schedule = parts.slice(0, 5).join(' ')
        const command = parts.slice(5).join(' ')
        const definition = definitions.find(job => job.command === command || job.legacyCommands?.includes(command))
        if (!definition) continue

        entries.set(definition.id, {
            schedule,
            enabled: true,
        })
    }

    return entries
}

export function replaceManagedBlock(
    crontab: string,
    entries: Map<string, ManagedCronEntry>,
    definitions: ManagedCronDefinition[],
) {
    const unmanaged = removeManagedCronLines(removeManagedBlock(crontab), definitions).trimEnd()
    const block = renderManagedBlock(entries, definitions)
    return [unmanaged, block].filter(Boolean).join('\n\n')
}

function extractManagedBlock(crontab: string) {
    const start = crontab.indexOf(BEGIN)
    const end = crontab.indexOf(END)
    if (start === -1 || end === -1 || end <= start) return ''
    return crontab.slice(start + BEGIN.length, end)
}

function removeManagedCronLines(crontab: string, definitions: ManagedCronDefinition[]) {
    const commands = new Set(definitions.flatMap(job => [job.command, ...(job.legacyCommands || [])]))
    return crontab
        .split('\n')
        .filter(rawLine => {
            const line = rawLine.trim()
            if (!line || line.startsWith('#')) return true
            const parts = line.split(/\s+/)
            if (parts.length < 6) return true
            return !commands.has(parts.slice(5).join(' '))
        })
        .join('\n')
}

function removeManagedBlock(crontab: string) {
    const start = crontab.indexOf(BEGIN)
    const end = crontab.indexOf(END)
    if (start === -1 || end === -1 || end <= start) return crontab
    return `${crontab.slice(0, start)}${crontab.slice(end + END.length)}`.trim()
}

function renderManagedBlock(entries: Map<string, ManagedCronEntry>, definitions: ManagedCronDefinition[]) {
    const lines = [BEGIN, '# Managed by Hanasand. Edit from the dashboard or source-controlled defaults.']
    for (const definition of definitions) {
        const entry = entries.get(definition.id) || {
            schedule: definition.defaultSchedule,
            enabled: false,
        }
        lines.push(`# id=${definition.id} name=${definition.name}`)
        lines.push(`${entry.enabled ? '' : '# '}${entry.schedule} ${definition.command}`)
    }
    lines.push(END)
    return lines.join('\n')
}
