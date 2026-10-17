import type { NextRequest } from 'next/server'

export async function parseAuthRequest<T>(
    req: NextRequest,
    formBody: (form: FormData) => T,
) {
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        const form = await req.formData()
        return {
            body: formBody(form),
            redirectPath: String(form.get('redirectPath') || '/dashboard'),
            wantsRedirect: true,
        }
    }

    return {
        body: await req.json().catch(() => null) as T | null,
        redirectPath: '/dashboard',
        wantsRedirect: false,
    }
}

export function parseAuthJson(text: string) {
    try {
        return JSON.parse(text)
    } catch {
        return null
    }
}
