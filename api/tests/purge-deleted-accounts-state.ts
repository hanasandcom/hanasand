export type Account = { id: string, name: string, email: string | null }
export type AuditRow = {
    id: number, object_type: string, actor_id: string | null, object_id: string | null,
    subject_id: string | null, request_id: string, ip: string, user_agent: string,
    context: Record<string, unknown>
}

function deferred() {
    let resolve!: () => void
    const promise = new Promise<void>(done => { resolve = done })
    return { promise, resolve }
}

export const state = {
    account: { id: 'deleted-user', name: 'Ada Example', email: 'ada@example.test' } as Account | null,
    accountDue: true,
    dueIds: ['deleted-user'],
    blockedOwnerAccounts: 0,
    mailUsername: 'ada' as string | null,
    organizationBlocker: false,
    failMailDeletion: false,
    failSessionRevocation: false,
    revokedSessionCount: 1,
    waitForMailDeletion: false,
    mailDeletionStarted: Promise.resolve(),
    markMailDeletionStarted: () => {},
    mailDeletionGate: Promise.resolve(),
    releaseMailDeletion: () => {},
    auditRows: [] as AuditRow[],
    sqlCalls: [] as string[],
    activeAdvisoryLocks: new Set<string>(),
    tokenDeletes: [] as string[],
    revokedUsers: [] as string[],
    deletedPrincipals: [] as string[],
    purgedSshUsers: [] as string[],
    waitForRestore: false,
    canRestore: true,
    restoreStarted: Promise.resolve(),
    markRestoreStarted: () => {},
    restoreGate: Promise.resolve(),
    releaseRestore: () => {},
}

export function containsIdentityField(value: unknown, identities: string[]): boolean {
    if (Array.isArray(value)) return value.some(item => containsIdentityField(item, identities))
    if (!value || typeof value !== 'object') return false
    return Object.entries(value as Record<string, unknown>).some(([key, item]) =>
        (/^(target|actor|user|account)[_-]?(name|email)$/i.test(key) && typeof item === 'string' && identities.includes(item))
        || containsIdentityField(item, identities))
}

export function resetState() {
    state.account = { id: 'deleted-user', name: 'Ada Example', email: 'ada@example.test' }
    state.accountDue = true
    state.dueIds = ['deleted-user']
    state.blockedOwnerAccounts = 0
    state.mailUsername = 'ada'
    state.organizationBlocker = false
    state.failMailDeletion = false
    state.failSessionRevocation = false
    state.revokedSessionCount = 1
    state.waitForMailDeletion = false
    const mailDeletion = deferred()
    state.mailDeletionStarted = new Promise(resolve => { state.markMailDeletionStarted = resolve })
    state.mailDeletionGate = mailDeletion.promise
    state.releaseMailDeletion = mailDeletion.resolve
    state.auditRows = [
        { id: 7, object_type: 'user', actor_id: 'deleted-user', object_id: 'deleted-user', subject_id: 'deleted-user', request_id: 'request-123', ip: '198.51.100.7', user_agent: 'Example browser', context: { targetId: 'deleted-user', targetName: 'Ada Example', note: 'deleted-user', reason: 'account closed' } },
        { id: 8, object_type: 'legacy_user_reference', actor_id: 'admin-user', object_id: 'organization-1', subject_id: 'deleted-user', request_id: 'unrelated-request', ip: '198.51.100.8', user_agent: 'Admin browser', context: { reason: 'legacy subject only' } },
        { id: 9, object_type: 'account_notice', actor_id: null, object_id: null, subject_id: null, request_id: 'name-email-only-request', ip: '198.51.100.9', user_agent: 'Legacy browser', context: { targetName: 'Ada Example', reason: 'name only' } },
        { id: 10, object_type: 'account_notice', actor_id: null, object_id: null, subject_id: null, request_id: 'email-only-request', ip: '198.51.100.10', user_agent: 'Legacy browser', context: { userEmail: 'ada@example.test', reason: 'email only' } },
        { id: 11, object_type: 'account_notice', actor_id: null, object_id: null, subject_id: null, request_id: 'free-text-name-request', ip: '198.51.100.11', user_agent: 'Unrelated browser', context: { reason: 'Ada Example' } },
    ]
    state.sqlCalls.length = 0
    state.activeAdvisoryLocks.clear()
    state.tokenDeletes.length = 0
    state.revokedUsers.length = 0
    state.deletedPrincipals.length = 0
    state.purgedSshUsers.length = 0
    state.waitForRestore = false
    state.canRestore = true
    const restore = deferred()
    state.restoreStarted = new Promise(resolve => { state.markRestoreStarted = resolve })
    state.restoreGate = restore.promise
    state.releaseRestore = restore.resolve
}
