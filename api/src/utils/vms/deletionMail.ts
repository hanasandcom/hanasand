import run from '#db'
import { addressForUser } from '#utils/mail/helpers.ts'
import { escapeHtml } from '#utils/auth/securityMail.ts'

type RecipientRow = { user_id: string, email: string | null }

export async function vmDeletionNotificationRecipients(ownerId: string, organizationId: string | null) {
    const result = await run(`
        SELECT DISTINCT recipient.user_id,
               COALESCE(NULLIF(user_account.email, ''), NULLIF(mail.recovery_email, ''), NULLIF(mail.mail_address, '')) AS email
        FROM (
            SELECT $1::text AS user_id
            UNION
            SELECT membership.user_id
            FROM organization_members membership
            JOIN organizations organization ON organization.id = membership.organization_id
            WHERE membership.organization_id = $2
              AND membership.status = 'active'
              AND membership.role IN ('owner', 'admin')
              AND organization.status = 'active'
        ) recipient
        JOIN users user_account ON user_account.id = recipient.user_id
        LEFT JOIN mail_accounts mail ON mail.user_id = user_account.id
        WHERE user_account.active IS TRUE
          AND user_account.deletion_scheduled_at IS NULL
    `, [ownerId, organizationId])
    const recipients = (result.rows as RecipientRow[]).map(row => ({
        userId: row.user_id,
        email: String(row.email || addressForUser(row.user_id)),
    }))
    return [...new Map(recipients.map(recipient => [recipient.email.toLowerCase(), recipient])).values()]
}

export function vmDeletionScheduledMail(input: {
    vmName: string
    actorId: string
    scheduledAt: string
    deleteAfter: string
    ip: string | null
    city: string | null
    region: string | null
    country: string | null
}) {
    const details = [
        ['VM', input.vmName],
        ['Scheduled by', `@${input.actorId}`],
        ['Scheduled at (UTC)', input.scheduledAt],
        ['Permanent deletion after (UTC)', input.deleteAfter],
        ['IP address', input.ip || 'Unavailable'],
        ['City', input.city || 'Unavailable'],
        ['Region', input.region || 'Unavailable'],
        ['Country', input.country || 'Unavailable'],
    ] as const
    const rows = details.map(([label, value]) => `${label}: ${value}`).join('\n')
    const htmlRows = details.map(([label, value]) => `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')
    const locationNote = 'Location is approximate and may be unavailable for private or unrecognized IP addresses.'
    const action = 'You can restore this VM from the VMs page during the 30-day recovery period.'

    return {
        subject: `VM ${input.vmName} is scheduled for deletion`,
        textBody: `VM ${input.vmName} has been scheduled for deletion. Its disk will be permanently deleted after the recovery period.\n\n${rows}\n\n${action}\n${locationNote}\nhttps://hanasand.com/vms`,
        htmlBody: `<h1>VM scheduled for deletion</h1><p>VM ${escapeHtml(input.vmName)} has been scheduled for deletion. Its disk will be permanently deleted after the recovery period.</p><table>${htmlRows}</table><p>${escapeHtml(action)}</p><p>${escapeHtml(locationNote)}</p><p><a href="https://hanasand.com/vms">Review or restore this VM</a></p>`,
    }
}
