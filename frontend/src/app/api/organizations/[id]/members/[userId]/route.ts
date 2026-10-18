import { organizationIdProxyHandler } from '@/app/api/organizations/_organizationApiProxy'

export const dynamic = 'force-dynamic'

export const DELETE = organizationIdProxyHandler<{ id: string, userId: string }>(params => `/members/${encodeURIComponent(params.userId)}`, { method: 'DELETE' })
