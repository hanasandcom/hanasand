import { randomUUID } from 'node:crypto'
import run from '#db'
import { sendSystemMail } from '#utils/mail/system.ts'

export type ContactInput = {
    name: string
    email: string
    company: string | null
    subject: string
    message: string
    source: string
}

export type PersistedContact = {
    ticketId: string
    receivedAt: string | Date
    payloadHash: string
    notificationStatus: string
    inserted: boolean
}

export type ContactDependencies = {
    persist: (input: ContactInput, idempotencyKey: string, payloadHash: string, requestId: string) => Promise<PersistedContact>
    notify: (input: ContactInput, ticketId: string) => Promise<void>
    markNotification: (ticketId: string, status: 'notified' | 'failed', error?: string) => Promise<void>
}

export const commercialContactDependencies: ContactDependencies = {
    persist: persistContactRequest,
    notify: notifyCommercialOwner,
    markNotification: markContactNotification,
}

async function persistContactRequest(input: ContactInput, idempotencyKey: string, payloadHash: string, requestId: string) {
    const ticketId = `HS-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`
    const inserted = await run(`
        INSERT INTO commercial_contact_requests (
            ticket_id, idempotency_key, payload_hash, name, email, company, subject,
            message, source, request_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING ticket_id, created_at, payload_hash, notification_status
    `, [
        ticketId, idempotencyKey, payloadHash, input.name, input.email, input.company,
        input.subject, input.message, input.source, requestId,
    ])
    const row = inserted.rows[0] || (await run(`
        SELECT ticket_id, created_at, payload_hash, notification_status
        FROM commercial_contact_requests
        WHERE idempotency_key = $1
    `, [idempotencyKey])).rows[0]
    if (!row) throw new Error('Contact request could not be stored.')
    return {
        ticketId: row.ticket_id,
        receivedAt: row.created_at,
        payloadHash: row.payload_hash,
        notificationStatus: row.notification_status,
        inserted: Boolean(inserted.rows[0]),
    }
}

async function notifyCommercialOwner(input: ContactInput, ticketId: string) {
    await sendSystemMail({
        to: process.env.COMMERCIAL_CONTACT_RECIPIENT || 'contact@hanasand.com',
        subject: `[${ticketId}] ${input.subject}`,
        senderName: `${input.name} (${input.email}, via contact form)`,
        replyTo: [{ email: input.email, name: input.name }],
        textBody: [
            `Ticket: ${ticketId}`,
            `Name: ${input.name}`,
            `Email: ${input.email}`,
            `Company: ${input.company || 'not provided'}`,
            '',
            input.message,
        ].join('\n'),
    })
}

async function markContactNotification(ticketId: string, status: 'notified' | 'failed', error = '') {
    await run(`
        UPDATE commercial_contact_requests
        SET notification_status = $2,
            notification_error = NULLIF($3, ''),
            notified_at = CASE WHEN $2 = 'notified' THEN NOW() ELSE notified_at END,
            updated_at = NOW()
        WHERE ticket_id = $1
    `, [ticketId, status, error])
}
