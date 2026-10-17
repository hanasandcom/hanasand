import { NextResponse } from 'next/server'
import { safeRedirectPath } from '@/utils/auth/safeRedirectPath'
import { parseAuthRequest, parseAuthJson } from '@/utils/auth/requestBody'

export { safeRedirectPath }
export { parseAuthJson as parseJson }
export { parseAuthRequest as parseAuthBody }

export function authRedirect(redirectPath: string, error: string) {
    const search = new URLSearchParams({ path: safeRedirectPath(redirectPath), error })
    return redirectTo(`/login?${search.toString()}`)
}

export function redirectTo(path: string) {
    return new NextResponse(null, { status: 303, headers: { Location: path } })
}
