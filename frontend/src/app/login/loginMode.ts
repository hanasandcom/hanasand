export type LoginMode = 'login' | 'signup' | 'verify-signup' | 'request-reset' | 'verify-reset'

export type LoginPageProps = {
    path: string | null
    serverInternal: boolean
    serverExpired: boolean
    socialError?: string
    initialMode?: 'login' | 'signup'
    serverError?: string
    initialUsername?: string
}

export const authInputClass = 'h-10 rounded-lg border border-ui-border bg-ui-panel px-3.5 text-sm font-medium text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/20'
export const authPrimaryButtonClass = 'group inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:border disabled:border-ui-border disabled:bg-ui-raised disabled:text-ui-muted'
export const authGhostButtonClass = 'inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-ui-muted transition hover:bg-ui-raised hover:text-ui-text disabled:cursor-not-allowed disabled:text-ui-muted/60'

export function safeRedirectPath(path: string | null) {
    if (!path || !path.startsWith('/') || path.startsWith('//')) return '/dashboard'
    return path
}
