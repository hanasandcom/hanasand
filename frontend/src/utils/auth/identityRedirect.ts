import { safeRedirectPath } from './safeRedirectPath'

const identityOrigin = 'https://identity.hanasand.com'
const appOrigin = 'https://hanasand.com'

export function isStagingLocalAuthUiEnabled(value = process.env.HANASAND_STAGING_LOCAL_AUTH_UI) {
    return value === '1'
}

export function identityAuthUrl(page: 'login' | 'signup', nextPath: unknown): string {
    const path = safeRedirectPath(nextPath)
    const returnTo = new URL(path, appOrigin).toString()
    return `${identityOrigin}/${page}?returnTo=${encodeURIComponent(returnTo)}`
}
