import { organizationIdProxyHandler } from '@/app/api/organizations/_organizationApiProxy'

export const dynamic = 'force-dynamic'

export const GET = organizationIdProxyHandler('/api-keys', { method: 'GET' })

export const POST = organizationIdProxyHandler('/api-keys', { method: 'POST' })
