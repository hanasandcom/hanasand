import { NextRequest } from 'next/server'
import { POST as proxyBackend } from '../../../backend/[...path]/route'

export const dynamic = 'force-dynamic'
export async function POST(request: NextRequest) {
    return proxyBackend(request, { params: Promise.resolve({ path: ['cases', 'monitoring', 'merge'] }) })
}
