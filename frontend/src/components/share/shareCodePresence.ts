export type SharePresenceUser = {
    clientId: string
    userId: string
    displayName: string
    color: string
    cursorLine: number | null
    cursorColumn: number | null
    selectionLength: number
    editing: boolean
    updatedAt: string
}

export type ShareConflict = {
    remoteContent: string
    localContent: string
    author: SharePresenceUser | null
    timestamp: string
}

export function getClientId() {
    const key = 'hanasand.share.clientId'
    let clientId = window.sessionStorage.getItem(key)
    if (!clientId) {
        clientId = crypto.randomUUID()
        window.sessionStorage.setItem(key, clientId)
    }

    return clientId
}

export function displayNameFor(userId: string) {
    if (!userId || userId === 'guest') return 'Guest'
    return userId.split(/[-_.\s]+/).filter(Boolean).map(part => part[0]?.toUpperCase() + part.slice(1)).join(' ')
}

export function normalizePresenceUsers(users: unknown): SharePresenceUser[] {
    if (!Array.isArray(users)) return []
    return users.map(normalizePresenceUser).filter((user): user is SharePresenceUser => Boolean(user))
}

export function normalizePresenceUser(user: unknown): SharePresenceUser | null {
    if (!user || typeof user !== 'object') return null
    const entry = user as Partial<SharePresenceUser>
    if (!entry.clientId) return null
    return {
        clientId: entry.clientId,
        userId: entry.userId || 'guest',
        displayName: entry.displayName || entry.userId || 'Guest',
        color: entry.color || 'var(--ui-primary)',
        cursorLine: typeof entry.cursorLine === 'number' ? entry.cursorLine : null,
        cursorColumn: typeof entry.cursorColumn === 'number' ? entry.cursorColumn : null,
        selectionLength: typeof entry.selectionLength === 'number' ? entry.selectionLength : 0,
        editing: Boolean(entry.editing),
        updatedAt: entry.updatedAt || new Date().toISOString(),
    }
}

export function mergePresence(users: SharePresenceUser[], next: SharePresenceUser | null) {
    if (!next) return users
    const existing = users.filter(user => user.clientId !== next.clientId)
    return [...existing, next]
}

export function getCursorPosition(content: string, offset: number) {
    const before = content.slice(0, offset)
    const lines = before.split(/\r?\n/)
    return {
        line: lines.length,
        column: lines[lines.length - 1]?.length + 1 || 1,
    }
}
