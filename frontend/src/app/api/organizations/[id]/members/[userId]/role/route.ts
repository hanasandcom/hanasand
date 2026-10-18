import { organizationIdProxyHandler } from '@/app/api/organizations/_organizationApiProxy'

export const dynamic = 'force-dynamic'

export const PATCH = organizationIdProxyHandler<{ id: string, userId: string }>(params => `/members/${encodeURIComponent(params.userId)}/role`, { method: 'PATCH' })
