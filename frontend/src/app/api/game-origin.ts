import { NextRequest } from 'next/server'

export default function hasGameOrigin(request: NextRequest) {
    const origin = request.headers.get('origin')
    if (!origin) return true
    if (origin === 'https://hanasand.com' || origin === 'https://www.hanasand.com') return true
    return process.env.NODE_ENV !== 'production' && origin === request.nextUrl.origin
}
