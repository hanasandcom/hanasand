import type { BrowserContextOptions } from 'playwright'

export type BrowserProfileMessage = {
    width?: unknown
    height?: unknown
    userAgent?: unknown
    locale?: unknown
    timezoneId?: unknown
    platform?: unknown
    isMobile?: unknown
    hasTouch?: unknown
}

const DEFAULT_WIDTH = 1280
const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

export function browserProfileForMessage(message: BrowserProfileMessage, network: 'tor' | 'regular') {
    const viewport = browserViewportForMessage(message)
    const locale = browserLocale(message.locale)
    const platform = browserPlatform(message.platform)

    const options: BrowserContextOptions = {
        viewport,
        ignoreHTTPSErrors: true,
        userAgent: browserUserAgent(message.userAgent),
        locale,
        timezoneId: browserTimezone(message.timezoneId),
        extraHTTPHeaders: { 'Accept-Language': acceptLanguageForLocale(locale) },
        isMobile: message.isMobile === true,
        hasTouch: message.hasTouch === true,
        acceptDownloads: true,
        serviceWorkers: 'block',
        permissions: network === 'regular' ? [] : ['clipboard-read', 'clipboard-write'],
    }

    return { options, platform, viewport }
}

export function browserViewportForMessage(message: Pick<BrowserProfileMessage, 'width' | 'height'>) {
    const width = clampNumber(message.width, 320, 2400, DEFAULT_WIDTH)
    const height = clampNumber(message.height, 320, 2160, Math.round(width * 9 / 16))
    return { width, height }
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return fallback
    return Math.max(min, Math.min(max, Math.round(numeric)))
}

function browserUserAgent(value: unknown) {
    const userAgent = typeof value === 'string' ? value.trim() : ''
    return !userAgent || userAgent.length > 512 ? CHROME_USER_AGENT : userAgent
}

function browserLocale(value: unknown) {
    const locale = typeof value === 'string' ? value.trim() : ''
    return /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(locale) ? locale : 'en-US'
}

function browserTimezone(value: unknown) {
    const timezone = typeof value === 'string' ? value.trim() : ''
    return /^[A-Za-z_]+\/[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)?$|^UTC$/.test(timezone) ? timezone : 'UTC'
}

function browserPlatform(value: unknown) {
    const platform = typeof value === 'string' ? value.trim() : ''
    return platform && platform.length <= 64 ? platform : ''
}

function acceptLanguageForLocale(locale: string) {
    const language = locale.split('-')[0]
    return language && language !== locale ? `${locale},${language};q=0.9` : `${locale};q=0.9,en;q=0.8`
}
