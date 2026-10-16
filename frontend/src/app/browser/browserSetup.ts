import config from '@/config'
import type { BrowserFingerprint, SandboxProfile, SandboxTool, UserAgentLabel } from './types'

export const storageKey = 'hanasand:browser:profiles:v1'
export const historyStorageKey = 'hanasand:browser:history:v1'
export const statsStorageKey = 'hanasand:browser:stats:v1'
export const clientIdStorageKey = 'hanasand:browser:client-id:v1'
export const profileApiPath = '/api/backend/browser/profiles'
export const historyApiPath = '/api/backend/browser/runs'
export const brokerBaseUrl = process.env.NEXT_PUBLIC_BROWSER_WS || `${config.url.api_client_wss}/ws/browser`
export const defaultTools: SandboxTool[] = [
    { id: 'virustotal', name: 'VirusTotal', url: 'https://www.virustotal.com/gui/search/{url}' },
    { id: 'urlquery', name: 'urlquery', url: 'https://urlquery.net/search?q={url}' },
    { id: 'webcrack', name: 'WebCrack', url: 'https://webcrack.netlify.app/' },
]
export const defaultProfiles: SandboxProfile[] = [
    { id: 'triage-default', name: 'SOC triage', tools: defaultTools },
    { id: 'browser-only', name: 'Browser only', tools: [] },
]
export const browserFingerprints: BrowserFingerprint[] = [
    {
        id: 'windows-11-chrome',
        label: 'Windows 11 Chrome',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        width: 1920,
        height: 1080,
        locale: 'en-US',
        timezoneId: 'America/New_York',
        platform: 'Win32',
    },
    {
        id: 'iphone-17-safari',
        label: 'iPhone 17 Safari',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
        width: 393,
        height: 852,
        locale: 'en-US',
        timezoneId: 'America/New_York',
        platform: 'iPhone',
        isMobile: true,
        hasTouch: true,
    },
    {
        id: 'macbook-safari',
        label: 'MacBook Safari',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
        width: 1512,
        height: 982,
        locale: 'en-US',
        timezoneId: 'America/Los_Angeles',
        platform: 'MacIntel',
    },
    {
        id: 'ubuntu-firefox',
        label: 'Ubuntu Firefox',
        userAgent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0',
        width: 1920,
        height: 1080,
        locale: 'en-US',
        timezoneId: 'UTC',
        platform: 'Linux x86_64',
    },
    {
        id: 'powershell',
        label: 'PowerShell',
        userAgent: 'Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/7.5.0',
        width: 1280,
        height: 720,
        locale: 'en-US',
        timezoneId: 'UTC',
        platform: 'Win32',
    },
    {
        id: 'curl-macos',
        label: 'macOS curl',
        userAgent: 'curl/8.7.1',
        width: 1280,
        height: 720,
        locale: 'en-US',
        timezoneId: 'UTC',
        platform: 'MacIntel',
    },
]
export const browserUserAgentLabels: UserAgentLabel[] = [
    { label: 'Headless Chrome', pattern: /HeadlessChrome\//i },
    { label: 'Microsoft Edge', pattern: /Edg(?:A|iOS)?\//i },
    { label: 'Opera', pattern: /OPR\//i },
    { label: 'Samsung Internet', pattern: /SamsungBrowser\//i },
    { label: 'Firefox', pattern: /(?:Firefox|FxiOS)\//i },
    { label: 'Chrome', pattern: /(?:Chrome|CriOS)\//i },
    { label: 'Safari', pattern: /Version\/.*Safari\//i },
    { label: 'Googlebot', pattern: /Googlebot\//i },
    { label: 'Bingbot', pattern: /bingbot\//i },
    { label: 'PowerShell', pattern: /WindowsPowerShell\//i },
    { label: 'curl', pattern: /(?:^|\s)curl\//i },
    { label: 'Wget', pattern: /(?:^|\s)Wget\//i },
    { label: 'Postman', pattern: /PostmanRuntime\//i },
    { label: 'Python requests', pattern: /python-requests\//i },
    { label: 'Java', pattern: /Java\/\d/i },
]

export function userAgentLabel(value: string, fallback: string) {
    const normalized = value.trim()
    if (!normalized) return `Inherited from ${fallback}`
    const quickLabel = browserFingerprints.find(item => item.userAgent === normalized)?.label
    if (quickLabel) return quickLabel
    return browserUserAgentLabels.find(item => item.pattern.test(normalized))?.label || 'Custom user agent'
}

export function normalizeTarget(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return ''
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return `https://${trimmed}`
}

export function isBrowserErrorUrl(value: string) {
    return value.startsWith('chrome-error://')
}

export function sessionId() {
    return `regular-${crypto.randomUUID()}`
}

export function scrollRouteFrameToTop(behavior: ScrollBehavior) {
    const frame = document.querySelector<HTMLElement>('.enterprise-theme')
    frame?.scrollTo({ top: 0, behavior })
}

export function brokerUrlForSession(baseUrl: string, id: string) {
    if (baseUrl.includes(':id')) return baseUrl.replace(':id', encodeURIComponent(id))
    return `${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(id)}`
}

export function streamUrlForPath(path: string) {
    if (/^https?:\/\//i.test(path)) return path
    const base = new URL(brokerBaseUrl)
    base.protocol = base.protocol === 'wss:' ? 'https:' : 'http:'
    return new URL(path, base).toString()
}

export function resolveToolUrl(template: string, target: string) {
    if (!target) return template
    return template.replaceAll('{url}', encodeURIComponent(target)).replaceAll('{rawUrl}', target)
}
