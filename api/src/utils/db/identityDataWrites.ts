import run from '#db'

type QueryResult = { rows: Record<string, any>[]; rowCount: number | null }
export type IdentityQuery = (sql: string, params?: (string | number | null | boolean | string[] | Date)[]) => Promise<QueryResult>

export async function upsertIdentityUserName(userId: string, name: string, query: IdentityQuery = run) {
    const updated = await query('UPDATE users SET name = $2 WHERE id = $1 RETURNING id', [userId, name])
    if (updated.rowCount) return
    try {
        await query('INSERT INTO users (id, name) VALUES ($1, $2)', [userId, name])
    } catch (error) {
        if ((error as { code?: string })?.code !== '23505') throw error
        const retry = await query('UPDATE users SET name = $2 WHERE id = $1 RETURNING id', [userId, name])
        if (!retry.rowCount) throw error
    }
}

export async function insertIdentityUserIfAbsent(input: {
    id: string
    name: string
    password: string
    avatar: string
    username?: string | null
    email?: string | null
    emailVerifiedAt?: Date | string | null
}, query: IdentityQuery = run) {
    try {
        await query(`
            INSERT INTO users (id, name, password, avatar, username, email, email_verified_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [input.id, input.name, input.password, input.avatar, input.username ?? null, input.email ?? null, input.emailVerifiedAt ?? null])
        return true
    } catch (error) {
        if ((error as { code?: string })?.code === '23505') return false
        throw error
    }
}

export async function incrementIdentityLoginAttempt(userId: string, ip: string, query: IdentityQuery = run) {
    const update = async () => query(`
        UPDATE attempts
           SET attempts = attempts + 1, ip = $2, timestamp = NOW()
         WHERE id = $1
        RETURNING id
    `, [userId, ip])
    const updated = await update()
    if (updated.rowCount) return
    try {
        await query('INSERT INTO attempts (id, attempts, ip) VALUES ($1, 1, $2)', [userId, ip])
    } catch (error) {
        if ((error as { code?: string })?.code !== '23505') throw error
        const retried = await update()
        if (!retried.rowCount) throw error
    }
}

export async function upsertIdentityPasskey(input: {
    credentialId: string
    userId: string
    publicKeyCose: string
    signCount: number
    algorithm: number
    aaguid: string
    label: string
}, query: IdentityQuery = run) {
    const values = [input.credentialId, input.userId, input.publicKeyCose, input.signCount,
        input.algorithm, input.aaguid, input.label]
    const update = async () => query(`
        UPDATE user_passkeys
           SET user_id = $2, public_key_cose = $3, sign_count = $4,
               alg = $5, aaguid = $6, label = $7
         WHERE credential_id = $1
        RETURNING credential_id
    `, values)
    const updated = await update()
    if (updated.rowCount) return
    try {
        await query(`
            INSERT INTO user_passkeys (credential_id, user_id, public_key_cose, sign_count, alg, aaguid, label, last_used_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)
        `, values)
    } catch (error) {
        if ((error as { code?: string })?.code !== '23505') throw error
        const retried = await update()
        if (!retried.rowCount) throw error
    }
}

export async function insertOrganizationPrivacyRequestIfAbsent(input: {
    id: string
    organizationId: string
    requestType: 'export' | 'deletion'
    status?: 'queued' | 'running' | 'completed' | 'failed'
    requestedBy: string | null
    requestId: string
    startedAt?: Date | string | null
}, query: IdentityQuery = run) {
    try {
        const result = await query(`
            INSERT INTO organization_privacy_requests (
                id, organization_id, request_type, status, requested_by, request_id, started_at
            ) VALUES ($1, $2, $3, COALESCE($4, 'queued'), $5, $6, $7)
            RETURNING id
        `, [input.id, input.organizationId, input.requestType, input.status ?? null,
            input.requestedBy, input.requestId, input.startedAt ?? null])
        return result.rows[0] ?? null
    } catch (error) {
        if ((error as { code?: string })?.code !== '23505') throw error
        return null
    }
}

export async function upsertOrganizationPrivacyDeletionRequest(input: {
    id: string
    organizationId: string
    requestedBy: string
    requestId: string
}, query: IdentityQuery = run) {
    const values = [input.id, input.organizationId, input.requestedBy, input.requestId]
    try {
        const inserted = await query(`
            INSERT INTO organization_privacy_requests (id, organization_id, request_type, requested_by, request_id)
            VALUES ($1, $2, 'deletion', $3, $4)
            RETURNING id
        `, values)
        return inserted.rows[0] ?? null
    } catch (error) {
        if ((error as { code?: string })?.code !== '23505') throw error
        const existing = await query(`
            SELECT id FROM organization_privacy_requests
             WHERE organization_id = $1 AND request_type = 'deletion' AND request_id = $2
             LIMIT 1
        `, [input.organizationId, input.requestId])
        if (existing.rows[0]) return existing.rows[0]
        throw error
    }
}

export async function upsertOrganizationMember(input: {
    organizationId: string
    userId: string
    role: string
    status?: 'active' | 'removed'
    invitedBy: string | null
    joinedAt?: Date | string
}, query: IdentityQuery = run) {
    const update = async () => query(`
        UPDATE organization_members
           SET role = CASE
                   WHEN role = 'owner' THEN 'owner'
                   WHEN role = 'admin' AND $3 IN ('editor', 'reader', 'member', 'viewer') THEN 'admin'
                   WHEN role = 'editor' AND $3 IN ('reader', 'member', 'viewer') THEN 'editor'
                   ELSE $3
               END,
               status = $4,
               removed_at = CASE WHEN $4 = 'active' THEN NULL ELSE removed_at END,
               invited_by = $5,
               joined_at = COALESCE($6::timestamptz, NOW())
         WHERE organization_id = $1 AND user_id = $2
        RETURNING *
    `, [input.organizationId, input.userId, input.role, input.status ?? 'active', input.invitedBy, input.joinedAt ?? null])

    const updated = await update()
    if (updated.rowCount) return updated.rows[0]
    try {
        const inserted = await query(`
            INSERT INTO organization_members (organization_id, user_id, role, status, invited_by, joined_at)
            VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()))
            RETURNING *
        `, [input.organizationId, input.userId, input.role, input.status ?? 'active', input.invitedBy, input.joinedAt ?? null])
        return inserted.rows[0]
    } catch (error) {
        if ((error as { code?: string })?.code !== '23505') throw error
        const retried = await update()
        if (!retried.rowCount) throw error
        return retried.rows[0]
    }
}

export async function upsertOrganizationInvite(input: {
    id: string
    organizationId: string
    email: string
    role: string
    invitedBy: string
    expiresAt: Date | string
}, query: IdentityQuery = run) {
    const update = async () => query(`
        UPDATE organization_invites
           SET role = $3,
               invited_by = $4,
               status = 'pending',
               revoked_at = NULL,
               accepted_at = NULL,
               accepted_by = NULL,
               expires_at = $5,
               created_at = NOW()
         WHERE organization_id = $1 AND email = $2
        RETURNING *
    `, [input.organizationId, input.email, input.role, input.invitedBy, input.expiresAt])

    const updated = await update()
    if (updated.rowCount) return updated.rows[0]
    try {
        const inserted = await query(`
            INSERT INTO organization_invites (id, organization_id, email, role, invited_by, status, expires_at)
            VALUES ($1, $2, $3, $4, $5, 'pending', $6)
            RETURNING *
        `, [input.id, input.organizationId, input.email, input.role, input.invitedBy, input.expiresAt])
        return inserted.rows[0]
    } catch (error) {
        if ((error as { code?: string })?.code !== '23505') throw error
        const retried = await update()
        if (!retried.rowCount) throw error
        return retried.rows[0]
    }
}

export async function upsertMailAccount(input: {
    userId: string
    username: string
    address: string
    encryptedPassword: string
    principalId: number | null
}, query: IdentityQuery = run) {
    const update = async () => query(`
        UPDATE mail_accounts
           SET mail_username = $2,
               mail_address = $3,
               mail_password_encrypted = $4,
               principal_id = $5,
               updated_at = NOW()
         WHERE user_id = $1
        RETURNING user_id
    `, [input.userId, input.username, input.address, input.encryptedPassword, input.principalId])

    const updated = await update()
    if (updated.rowCount) return
    try {
        await query(`
            INSERT INTO mail_accounts (user_id, mail_username, mail_address, mail_password_encrypted, principal_id)
            VALUES ($1, $2, $3, $4, $5)
        `, [input.userId, input.username, input.address, input.encryptedPassword, input.principalId])
    } catch (error) {
        if ((error as { code?: string })?.code !== '23505') throw error
        const retried = await update()
        if (!retried.rowCount) throw error
    }
}

export async function upsertAdminAccessRecoveryApproval(input: {
    requestId: string
    organizationId: string
    inviteId: string
    targetUserId: string | null
    requestedBy: string
    requestedReason: string
    requestContext: string
    approvalRequired: boolean
    status: string
    expiresAt: Date | string
}, query: IdentityQuery = run) {
    const values = [input.requestId, input.organizationId, input.inviteId, input.targetUserId,
        input.requestedBy, input.requestedReason, input.requestContext, input.approvalRequired,
        input.status, input.expiresAt]
    const update = async () => query(`
        UPDATE admin_access_recovery_approvals
           SET organization_id = $2,
               invite_id = $3,
               target_user_id = $4,
               requested_by = $5,
               requested_reason = $6,
               request_context = $7,
               approval_required = $8,
               status = $9,
               approved_by = NULL,
               approved_at = NULL,
               denied_by = NULL,
               denied_at = NULL,
               decision_reason = NULL,
               outcome = 'success',
               expires_at = $10,
               updated_at = NOW()
         WHERE request_id = $1
        RETURNING request_id
    `, values)

    const updated = await update()
    if (updated.rowCount) return
    try {
        await query(`
            INSERT INTO admin_access_recovery_approvals (
                request_id, organization_id, invite_id, target_user_id, requested_by,
                requested_reason, request_context, approval_required, status, outcome, expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'success', $10)
        `, values)
    } catch (error) {
        if ((error as { code?: string })?.code !== '23505') throw error
        const retried = await update()
        if (!retried.rowCount) throw error
    }
}

export async function upsertSystemEventAcknowledgment(eventId: number, userId: string, query: IdentityQuery = run) {
    const update = async () => query(`
        UPDATE system_event_acknowledgments
           SET acknowledged_by = $2, acknowledged_at = NOW()
         WHERE event_id = $1
        RETURNING acknowledged_at, acknowledged_by
    `, [eventId, userId])
    const updated = await update()
    if (updated.rowCount) return updated.rows[0]
    try {
        const inserted = await query(`
            INSERT INTO system_event_acknowledgments (event_id, acknowledged_by)
            SELECT id, $2 FROM system_events WHERE id = $1
            RETURNING acknowledged_at, acknowledged_by
        `, [eventId, userId])
        return inserted.rows[0] ?? null
    } catch (error) {
        if ((error as { code?: string })?.code !== '23505') throw error
        const retried = await update()
        if (retried.rowCount) return retried.rows[0]
        return null
    }
}
