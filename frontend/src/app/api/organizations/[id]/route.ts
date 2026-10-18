import { organizationIdProxyHandler } from '@/app/api/organizations/_organizationApiProxy'

export const dynamic = 'force-dynamic'

export const GET = organizationIdProxyHandler('', { method: 'GET' })
