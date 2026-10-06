import { NextRequest } from 'next/server'
import { GET as getBackend } from '@/app/api/backend/[...path]/route'
import TuningPage, { type TuningData } from './pageClient'

export const dynamic = 'force-dynamic'

export default async function TuningPageServer() {
    const request = new NextRequest('http://localhost/api/backend/logs/tuning')
    const response = await getBackend(request, { params: Promise.resolve({ path: ['logs', 'tuning'] }) })
    if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: unknown } | null
        const message = typeof payload?.error === 'string'
            ? payload.error
            : payload?.error && typeof payload.error === 'object' && 'message' in payload.error && typeof payload.error.message === 'string'
                ? payload.error.message
                : 'Log patterns could not be loaded.'
        return <TuningPage initialError={message} />
    }

    const initialData = await response.json() as TuningData
    return <TuningPage initialData={initialData} />
}
