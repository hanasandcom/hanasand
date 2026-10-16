import { state } from './admin-support-routes-state.ts'
import { runSupportSessionQueries } from './admin-support-session-queries.ts'
import { runSupportAccessQueries } from './admin-support-access-queries.ts'
import { runSupportMembershipQueries } from './admin-support-membership-queries.ts'
import { runSupportWriteQueries } from './admin-support-write-queries.ts'
import { runSupportAuditQueries } from './admin-support-audit-queries.ts'

export { state }

export async function run(sql: string, values: unknown[] = []) {
    state.queries.push({ sql, values })
    const normalizedSql = sql.replace(/\s+/g, ' ').trim()
    const queries = [
        runSupportSessionQueries,
        runSupportAccessQueries,
        runSupportMembershipQueries,
        runSupportWriteQueries,
        runSupportAuditQueries,
    ]
    for (const query of queries) {
        const result = await query(sql, normalizedSql, values)
        if (result) return result
    }
    throw new Error(`Unmatched admin-support test SQL query:\n${sql}`)
}

export function resetAdminSupportDatabaseFixture() {
    state.actor = { valid: true, id: 'support-admin', impersonating: false }
    state.internalAccess = true
    state.eventRows = []
    state.approvalRows = []
    state.supportDecisionApproval = null
    state.supportOrganization = null
    state.supportUser = null
    state.supportUserInvites = []
    state.supportInspectionInvite = undefined
    state.supportInspectionMember = undefined
    state.supportInspectionAuditRows = []
    state.supportInviteReads = 0
    state.duplicateInviteAction = null
    state.inviteActionWrites = 0
    state.acceptedInviteWinsRace = false
    state.supportRecoveryInviteStatus = null
    state.supportRecoveryInviteExpiry = '2026-11-01T00:00:00.000Z'
    state.supportRecoveryInviteUpsert = null
    state.supportRecoveryInviteResult = null
    state.supportRecoveryApprovalWrites = 0
    state.supportMemberRole = 'editor'
    state.supportOwnerCounts = [2]
    state.supportAvailabilityResults = []
    state.supportSessionEvents = []
    state.nextSupportEventId = 100
    state.inviteActionInputs.length = 0
    state.queries.length = 0
    state.recordedEvents.length = 0
}
