import { organizationIdProxyHandler } from '@/app/api/organizations/_organizationApiProxy'

export const dynamic = 'force-dynamic'

export const GET = organizationIdProxyHandler('/privacy', { method: 'GET', timeoutMs: 30000 })

export const POST = organizationIdProxyHandler('/privacy', { method: 'POST', timeoutMs: 60000 })
