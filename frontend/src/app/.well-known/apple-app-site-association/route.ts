import { NextResponse } from 'next/server'

const association = {
    webcredentials: {
        apps: ['8VBNY258K7.com.hanasand.app'],
    },
}

export function GET() {
    return NextResponse.json(association, {
        headers: {
            'Cache-Control': 'public, max-age=3600',
        },
    })
}
