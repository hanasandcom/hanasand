import { organizationIdProxyHandler } from '@/app/api/organizations/_organizationApiProxy'

export const dynamic = 'force-dynamic'

export const DELETE = organizationIdProxyHandler<{ id: string, keyId: string }>(params => `/api-keys/${encodeURIComponent(params.keyId)}`, { method: 'DELETE' })
