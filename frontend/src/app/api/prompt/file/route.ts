import { NextRequest, NextResponse } from 'next/server'
import { readPromptPortalFile, readPromptPortalState, verifyWorkerToken } from '@/utils/promptPortal/store'
import requirePromptPortalSession from '@/utils/promptPortal/sessionAccess'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
    const worker = verifyWorkerToken(request.nextUrl.searchParams.get('token'))
    if (!worker) {
        const access = await requirePromptPortalSession(request)
        if ('response' in access) return access.response
    }

    const state = await readPromptPortalState()
    const item = state.items.find(candidate => candidate.id === request.nextUrl.searchParams.get('itemId'))
    const file = item?.files.find(candidate => candidate.id === request.nextUrl.searchParams.get('fileId'))
    if (!file) return NextResponse.json({ ok: false, error: 'File not found.' }, { status: 404 })

    const data = await readPromptPortalFile(file.path)
    return new NextResponse(data, {
        headers: {
            'content-type': file.type,
            'cache-control': 'no-store',
            'vary': 'Cookie',
            'content-length': String(file.size),
        },
    })
}
