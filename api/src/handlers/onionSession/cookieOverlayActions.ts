import type { Frame, Page } from 'playwright'
import { cookiePromptText } from './cookieSelectors.ts'

export const hideCandidateOverlays = async (frame: Frame) => frame.evaluate(() => {
    const selectors = [
        '[id*="cookie" i]',
        '[class*="cookie" i]',
        '[id*="consent" i]',
        '[class*="consent" i]',
        '[id*="onetrust" i]',
        '[class*="onetrust" i]',
        '[id*="gdpr" i]',
        '[class*="gdpr" i]',
        '[id*="cc-" i]',
        '[class*="cc-" i]',
        '[id*="cookie-banner" i]',
        '[class*="cookie-banner" i]',
        '[id*="sp_message" i]',
        '[class*="sp_message" i]',
        '[id*="cookie-consent" i]',
        '[class*="cookie-consent" i]',
        '[role="dialog"][aria-label*="cookie" i]',
        '[role="dialog"][aria-label*="consent" i]',
    ]
    for (const selector of selectors) {
        for (const node of Array.from(document.querySelectorAll(selector))) {
            const candidate = node as HTMLElement
            const text = (candidate.textContent || '').toLowerCase()
            const computedStyle = window.getComputedStyle(candidate)
            const containsCookieCopy = /cookie|consent|gdpr|privacy|tracking|preferences|analytics|essential|data collection/i.test(text)
            const isFixedOrSticky = ['fixed', 'sticky'].includes(computedStyle.position)
            const fillsView = candidate.getBoundingClientRect().width >= window.innerWidth * 0.5 && candidate.getBoundingClientRect().height >= window.innerHeight * 0.15
            if ((containsCookieCopy || isFixedOrSticky) && candidate.style.display !== 'none') {
                candidate.style.setProperty('display', 'none', 'important')
                candidate.setAttribute('data-hanasand-cookie-dismissed', '1')
            }
            const hasHighZ = Number(computedStyle.zIndex || 0) >= 2000
            const fixedOverlay = ['fixed', 'sticky', 'absolute'].includes(computedStyle.position)
            const fillsViewport = candidate.getBoundingClientRect().width >= window.innerWidth * 0.7 && candidate.getBoundingClientRect().height >= window.innerHeight * 0.25
            if ((hasHighZ && fixedOverlay && fillsViewport) || (containsCookieCopy && fillsView)) {
                candidate.style.setProperty('display', 'none', 'important')
                candidate.style.setProperty('pointer-events', 'none', 'important')
            }
        }
    }

    const iframes = Array.from(document.querySelectorAll('iframe')).filter(node => {
        const source = (node.getAttribute('src') || '').toLowerCase()
        const text = (node.textContent || node.getAttribute('title') || '').toLowerCase()
        const style = window.getComputedStyle(node)
        const rect = node.getBoundingClientRect()
        const textLooksLikeConsent = /cookie|consent|gdpr|privacy|trust|onetrust|cmp|civic|quantcast|cookiebot/i.test(source + ' ' + text)
        return textLooksLikeConsent || (['fixed', 'sticky'].includes(style.position) && rect.width >= window.innerWidth * 0.35 && rect.height >= window.innerHeight * 0.35)
    })
    for (const iframe of iframes) {
        iframe.style.setProperty('display', 'none', 'important')
        iframe.setAttribute('data-hanasand-cookie-dismissed', '1')
    }
    const shadowContainers = Array.from(document.querySelectorAll('[id*="sp_message" i], [class*="sp_message" i], [class*="cookie-banner" i], [id*="cookie-banner" i], [id*="cmp" i], [class*="cmp" i]'))
        .filter(node => {
            const text = (node.textContent || '').toLowerCase()
            const rect = node.getBoundingClientRect()
            return /cookie|consent|privacy|gdpr|tracking|preferences|notice/i.test(text) || rect.top < 120 || rect.height > 120
        })
    for (const node of shadowContainers) {
        const candidate = node as HTMLElement
        candidate.style.setProperty('display', 'none', 'important')
        candidate.setAttribute('data-hanasand-cookie-dismissed', '1')
    }
}).catch(() => undefined)

export const hideTopLevelConsentFrame = async (frame: Page | Frame) => {
    await frame.evaluate(() => {
        const overlays = Array.from(document.querySelectorAll('iframe')).filter((iframe) => {
            const style = window.getComputedStyle(iframe)
            const rect = iframe.getBoundingClientRect()
            const src = (iframe.getAttribute('src') || '').toLowerCase()
            const isLargeFixedOverlay = ['fixed', 'absolute'].includes(style.position) && rect.height >= window.innerHeight * 0.35 && rect.width >= window.innerWidth * 0.35
            const hints = /consent|cookie|gdpr|privacy|trust|onetrust|cmp|civic|quantcast|cookiebot|otnotice|ot-banner|euconsent|banner|overlay/i
            return (hints.test(src) || isLargeFixedOverlay) && style.zIndex ? Number.parseInt(style.zIndex, 10) >= 1 : false
        })

        for (const iframe of overlays) {
            iframe.style.setProperty('display', 'none', 'important')
            iframe.setAttribute('data-hanasand-cookie-dismissed', '1')
        }
    }).catch(() => undefined)
}

export const hasCookieCopy = async (frame: Frame) => {
    try {
        const text = await frame.locator('body').innerText().catch(() => '')
        return cookiePromptText(text)
    } catch {
        return false
    }
}

export const aggressivelyHideConsentShims = async (frame: Frame) => frame.evaluate(() => {
    const blockedWords = /cookie|consent|privacy|gdpr|tracking|preferences|data collection|essentials|onetrust|truste/i
    const isLikelyModal = (node: Element) => {
        const style = window.getComputedStyle(node)
        const rect = node.getBoundingClientRect()
        const role = (node.getAttribute('role') || '').toLowerCase()
        const text = (node.textContent || '').toLowerCase()
        const isDialog = role === 'dialog' || node.matches('[role="dialog"]')
        const isOverlay = ['fixed', 'absolute', 'sticky'].includes(style.position)
        const highZ = Number.parseInt(style.zIndex || '0', 10)
        return (isDialog || isOverlay || /modal|overlay|backdrop/i.test(node.tagName.toLowerCase()) || /dialog|consent|cookie/i.test(node.className || node.id || ''))
            && (highZ >= 1000 || rect.width >= window.innerWidth * 0.35 || rect.height >= window.innerHeight * 0.35)
            && blockedWords.test(text)
    }

    for (const element of Array.from(document.querySelectorAll('*'))) {
        if (!isLikelyModal(element)) continue
        const node = element as HTMLElement
        node.style.setProperty('display', 'none', 'important')
        node.setAttribute('data-hanasand-cookie-dismissed', '1')
    }

    const forms = Array.from(document.querySelectorAll('iframe')).filter(node => blockedWords.test((node.src || '').toLowerCase()) || blockedWords.test(node.className || node.id || ''))
    for (const iframe of forms) {
        const frame = iframe as HTMLIFrameElement
        frame.style.setProperty('display', 'none', 'important')
        frame.style.setProperty('opacity', '0', 'important')
    }
}).catch(() => undefined)

