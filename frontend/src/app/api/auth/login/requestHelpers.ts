import { NextRequest, NextResponse } from 'next/server'

export async function parseAuthBody(req: NextRequest) {
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        const form = await req.formData()
        return {
            body: {
                id: String(form.get('username') || form.get('id') || ''),
                password: String(form.get('password') || ''),
            },
            redirectPath: String(form.get('redirectPath') || '/dashboard'),
            wantsRedirect: true,
        }
    }

    return {
        body: await req.json().catch(() => null) as { id?: string, password?: string } | null,
        redirectPath: '/dashboard',
        wantsRedirect: false,
    }
}

export function parseJson(text: string) {
    try {
        return JSON.parse(text)
    } catch {
        return null
    }
}

export function authRedirect(redirectPath: string, error: string) {
    const search = new URLSearchParams({ path: safeRedirectPath(redirectPath), error })
    return redirectTo(`/login?${search.toString()}`)
}

export function redirectTo(path: string) {
    return new NextResponse(null, { status: 303, headers: { Location: path } })
}

export function safeRedirectPath(path: string | null) {
    if (!path || !path.startsWith('/') || path.startsWith('//')) return '/dashboard'
    return path
}
