// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { handleShareCodeMessage, type ShareCodeMessageContext } from '../src/components/share/shareCodeMessages'
import { getCursorPosition, normalizePresenceUsers, type SharePresenceUser } from '../src/components/share/shareCodePresence'

function createContext(saveState: 'saved' | 'saving' | 'queued' = 'saving') {
    const calls: Array<[string, unknown]> = []
    const presenceUsersRef = { current: [{ clientId: 'writer-2', userId: 'writer-2', displayName: 'Writer 2', color: '#abc', cursorLine: 1, cursorColumn: 1, selectionLength: 0, editing: false, updatedAt: 'now' }] }
    const context = {
        latestContentRef: { current: 'local' },
        saveStateRef: { current: saveState },
        presenceUsersRef,
        setError: (value: unknown) => calls.push(['error', value]),
        setParticipants: (value: unknown) => calls.push(['participants', value]),
        setShare: (update: (share: Share) => Share) => calls.push(['share', update({ id: 'share-1' } as Share)]),
        setEditingContent: (value: unknown) => calls.push(['content', value]),
        setPresenceUsers: (value: SharePresenceUser[] | ((users: SharePresenceUser[]) => SharePresenceUser[])) => {
            presenceUsersRef.current = typeof value === 'function' ? value(presenceUsersRef.current) : value
            calls.push(['presence', presenceUsersRef.current])
        },
        setRemoteNotice: (value: unknown) => calls.push(['notice', value]),
        setConflict: (value: unknown) => calls.push(['conflict', value]),
        onSaveStateChange: (value: unknown) => calls.push(['saveState', value]),
    } as unknown as ShareCodeMessageContext
    return { context, calls }
}

test('remote updates preserve conflict behavior for unsaved edits and apply when saved', () => {
    const message = { type: 'update', clientId: 'writer-2', content: 'remote', participants: 2, timestamp: 'then' }
    const unsaved = createContext()
    handleShareCodeMessage(JSON.stringify(message), unsaved.context)
    expect(unsaved.calls).toEqual([
        ['participants', 2],
        ['conflict', { remoteContent: 'remote', localContent: 'local', author: unsaved.context.presenceUsersRef.current[0], timestamp: 'then' }],
        ['notice', 'Writer 2 changed this file while your edit is unsaved.'],
    ])

    const saved = createContext('saved')
    handleShareCodeMessage(JSON.stringify(message), saved.context)
    expect(saved.calls.map(([name]) => name)).toEqual(['participants', 'content', 'share', 'notice'])
    expect(saved.context.latestContentRef.current).toBe('remote')
})

test('join and presence events normalize defaults while cursor coordinates stay one-based', () => {
    const { context, calls } = createContext('saved')
    handleShareCodeMessage(JSON.stringify({ type: 'join', participants: 1, users: [{ clientId: 'guest-1' }, {}] }), context)
    expect(calls.map(([name]) => name)).toEqual(['participants', 'presence'])
    expect(context.presenceUsersRef.current[0]).toMatchObject({ clientId: 'guest-1', userId: 'guest', displayName: 'Guest', color: 'var(--ui-primary)' })
    calls.length = 0
    handleShareCodeMessage(JSON.stringify({ type: 'presence', user: { clientId: 'guest-2', displayName: 'Guest Two' } }), context)
    expect(calls.map(([name]) => name)).toEqual(['presence'])
    expect(context.presenceUsersRef.current.map(user => user.clientId)).toEqual(['guest-1', 'guest-2'])
    expect(normalizePresenceUsers(null)).toEqual([])
    expect(getCursorPosition('first\r\nsecond', 9)).toEqual({ line: 2, column: 3 })
})

test('save errors queue the draft and acknowledgments only clear the matching content', () => {
    const { context, calls } = createContext()
    handleShareCodeMessage(JSON.stringify({ type: 'error' }), context)
    expect(calls).toEqual([['saveState', 'queued'], ['error', 'Unable to save your changes. Please retry.']])
    calls.length = 0
    handleShareCodeMessage(JSON.stringify({ type: 'ack', content: 'old' }), context)
    expect(calls).toEqual([])
    handleShareCodeMessage(JSON.stringify({ type: 'ack', content: 'local' }), context)
    expect(calls).toEqual([['error', null], ['saveState', 'saved']])
})
