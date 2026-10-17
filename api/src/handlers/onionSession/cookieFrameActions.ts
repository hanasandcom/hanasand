import type { Frame } from 'playwright'
import { cookieSelectors } from './cookieSelectors.ts'

export const clickExactConsentAction = async (frame: Frame) => frame.evaluate(() => {
    const wanted = [
        'godta alle',
        'accept all',
        'accept all cookies',
        'allow all',
        'allow all cookies',
        'i agree',
    ]
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"], input[type="button"], input[type="submit"]'))
    const target = candidates.find(candidate => {
        const text = `${candidate.textContent || ''} ${(candidate as HTMLInputElement).value || ''} ${candidate.getAttribute('aria-label') || ''}`.trim().toLowerCase()
        if (!wanted.some(value => text.includes(value))) return false
        const style = window.getComputedStyle(candidate)
        const rect = candidate.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    })
    if (!target) return false
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
    }
    target.click()
    return true
}).catch(() => false)

export const clickInFrame = async (frame: Frame) => {
    for (const selector of cookieSelectors) {
        try {
            const locator = frame.locator(selector).first()
            if (await locator.isVisible().catch(() => false)) {
                await locator.click({ timeout: 1200 }).catch(() => undefined)
                await frame.waitForTimeout(120).catch(() => undefined)
                return true
            }
        } catch {
            // Continue trying other selectors.
        }
    }
    return false
}

export const clickTextButtonInFrame = async (frame: Frame) => frame.evaluate(() => {
    const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(
            'button, a, input[type="button"], input[type="submit"], [role="button"]',
        ),
    )
    const normalize = (candidate: string) => (candidate || '').trim().toLowerCase()
    const aroundCandidateText = (candidate: HTMLElement) => {
        const target = candidate.closest('[role="dialog"], [class*="cookie" i], [id*="cookie" i], [class*="consent" i], [id*="consent" i]')
        if (target) {
            return `${target.textContent || ''} ${candidate.textContent || ''}`
        }
        return candidate.textContent || ''
    }
    const isCookieAction = (value: string) => /^(accept|agree|allow|got it|continue|ok|understand|close|dismiss|not now|reject|decline|godta|aksepter|accepter|tillat|lagre|enable|essential|required|manage|customize|settings|preference|configure|save|save and continue|proceed|i agree)/.test(value)
        && /(cookie|consent|privacy|gdpr|tracking|marketing|analytics|preferences)/.test(value)
    const isCookieLabel = (value: string) => /(cookie|consent|privacy|gdpr|tracking|analytics|preferences|opt.?out|data collection|essential)/.test(value)
    const target = candidates.find(candidate => {
        const value = normalize(candidate.textContent || '')
        const contextValue = normalize(aroundCandidateText(candidate))
        return isCookieAction(value) && isCookieLabel(contextValue) && candidate.offsetParent !== null
    })
    if (!target) return false
    target.click()
    return true
}).catch(() => false)

export const clickShadowCookieElements = async (frame: Frame) => frame.evaluate(() => {
    const walk = (root: ParentNode): Element[] => {
        const nodes = Array.from(root.querySelectorAll<HTMLElement>('*'))
        const shadowHosts = Array.from(root.querySelectorAll<HTMLElement>('*')).filter(node => node.shadowRoot)
        const fromShadow: Element[] = shadowHosts.flatMap(node => walk(node.shadowRoot as unknown as ParentNode))
        return [...nodes, ...fromShadow]
    }

    const candidates = walk(document)
        .filter((candidate): candidate is HTMLElement => candidate instanceof HTMLButtonElement || candidate.getAttribute('role') === 'button' || candidate.tagName === 'A')
        .filter(candidate => {
            const value = (candidate.textContent || '').toLowerCase()
            const hasCookieAction = /^(accept|agree|allow|got it|continue|ok|understand|close|dismiss|not now|godta|accepter|enable|acceptall|only|essential|required|all|save|save and close|yes|proceed)/.test(value)
            const hasCookieContext = /(cookie|consent|privacy|gdpr|tracking|analytics|preferences|data collection|essential)/.test(value)
            return hasCookieAction && hasCookieContext && candidate.getAttribute('aria-hidden') !== 'true'
        })

    for (const candidate of candidates) {
        candidate.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        return true
    }

    return false
}).catch(() => false)

export const clickConsentButtonsByText = async (frame: Frame) => frame.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(
        'button, a, input[type="button"], input[type="submit"], [role="button"]',
    ))
    const toFlatText = (value: string | null | undefined) => (value || '').trim().toLowerCase()
    const hasCookieContext = (value: string) => /(cookie|consent|privacy|gdpr|tracking|analytics|preferences|data collection)/i.test(value)
    const hasCookieAction = (value: string) => /^(accept|agree|allow|got it|continue|ok|understand|close|dismiss|not now|reject|decline|godta|aksepter|accepter|tillat|lagre|enable|save|save and continue|proceed|i agree)/i.test(value)

    const candidate = nodes.find((node) => {
        const text = toFlatText(node.textContent)
        const title = toFlatText(node.getAttribute('title'))
        const value = toFlatText((node as HTMLInputElement).getAttribute('value') || '')
        const aria = toFlatText(node.getAttribute('aria-label'))
        const parentText = toFlatText(node.closest('[role="dialog"], [class*="cookie" i], [id*="cookie" i], [class*="consent" i], [id*="consent" i]')?.textContent)
        const sourceText = [text, title, value, aria, parentText].join(' ')
        return hasCookieAction(text) && hasCookieContext(sourceText)
    })

    if (!candidate) return false
    candidate.click()
    return true
}).catch(() => false)

