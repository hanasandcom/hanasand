import { organizationIdProxyHandler } from '@/app/api/organizations/_organizationApiProxy'

export const dynamic = 'force-dynamic'

export const POST = organizationIdProxyHandler<{ id: string, inviteId: string }>(params => `/invites/${encodeURIComponent(params.inviteId)}/actions`, { method: 'POST' })
