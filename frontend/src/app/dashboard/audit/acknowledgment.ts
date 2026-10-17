import { getCookie } from '@/utils/cookies/cookies'
import config from '@/config'

export type AuditAcknowledgment = {
    acknowledgedAt: string | null
    acknowledgedBy: string | null
}

export async function saveAuditAcknowledgment(eventId: number, acknowledged: boolean, fallback: string): Promise<AuditAcknowledgment> {
    const response = await fetch(`${config.url.api}/admin/audit-events/${eventId}/acknowledgment`, {
        method: acknowledged ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${getCookie('access_token') || ''}`, id: getCookie('id') || '' },
    })
    const result = await response.json()
    if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : fallback)
    return {
        acknowledgedAt: typeof result.acknowledged_at === 'string' ? result.acknowledged_at : null,
        acknowledgedBy: typeof result.acknowledged_by === 'string' ? result.acknowledged_by : null,
    }
}
