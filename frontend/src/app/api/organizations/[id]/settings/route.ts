import { organizationIdProxyHandler } from '@/app/api/organizations/_organizationApiProxy'

export const dynamic = 'force-dynamic'

export const GET = organizationIdProxyHandler('/settings', { method: 'GET' })

export const PUT = organizationIdProxyHandler('/settings', { method: 'PUT' })
