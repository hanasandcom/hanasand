import { extractAttribute, extractControls, MAX_STRUCTURE_ITEMS, stripTags } from './browserTaskContent.ts'

export function inspectPageQuality(
    html: string,
    structure: ReturnType<typeof import('./browserTaskContent.ts').extractPageContent>['structure'],
    pageUrl: string,
    title: string | null,
    controls: ReturnType<typeof extractControls>,
) {
    const links = structure.links || []
    const parsedUrl = parseUrl(pageUrl)
    const anchors = new Set([...html.matchAll(/\sid=["']([^"']+)["']/gi)].map((match) => match[1]))
    const brokenLinks = links
        .filter((link) => {
            const href = (link.href || '').trim()
            if (!href || href === '#') return true
            if (href.startsWith('#')) return !anchors.has(href.slice(1))
            if (/^(mailto:|tel:|https?:\/\/|\/)/i.test(href)) return false
            if (parsedUrl && href.startsWith(`${parsedUrl.origin}/`)) return false
            return href.startsWith('javascript:')
        })
        .map((link) => [link.text || '<untitled link>', link.href || '<empty>'].join(' -> '))
        .slice(0, MAX_STRUCTURE_ITEMS)
    const unlabeledControls = controls
        .filter((control) => !/type=["'](?:hidden|submit|button|checkbox|radio)["']/i.test(control.attrs))
        .filter((control) => {
            const id = extractAttribute(control.attrs, 'id')
            return !extractAttribute(control.attrs, 'aria-label')
                && !extractAttribute(control.attrs, 'aria-labelledby')
                && !(id && new RegExp(`<label[^>]+for=["']${escapeRegExp(id)}["']`, 'i').test(html))
                && !new RegExp(`<label\\b[^>]*>[\\s\\S]{0,240}<${control.tag}\\b`, 'i').test(html)
        })
        .map((control) => [extractAttribute(control.attrs, 'name'), extractAttribute(control.attrs, 'placeholder'), control.tag].filter(Boolean).join(' / '))
        .slice(0, MAX_STRUCTURE_ITEMS)
    const imagesWithoutAlt = [...html.matchAll(/<img\s+([^>]*?)>/gi)]
        .filter((match) => !/\salt\s*=/i.test(match[1] || ''))
        .map((match) => extractAttribute(match[1] || '', 'src') || '<inline image>')
        .slice(0, MAX_STRUCTURE_ITEMS)

    return {
        accessibilityBasics: {
            hasTitle: Boolean(title),
            hasH1: /<h1\b/i.test(html),
            hasViewportMeta: structure.hasViewportMeta,
            unlabeledControls,
            imagesWithoutAlt,
        },
        brokenLinkBasics: {
            checked: links.length,
            issues: brokenLinks,
        },
        criticalJourneySignals: inferCriticalJourneySignals(html, structure),
        notVerified: [
            'Production build output',
            'JavaScript runtime errors',
            'Mobile rendered viewport',
            'Keyboard and screen-reader behavior',
            'Forms, checkout, auth, booking, dashboard CRUD side effects',
        ],
    }
}

function inferCriticalJourneySignals(html: string, structure: ReturnType<typeof import('./browserTaskContent.ts').extractPageContent>['structure']) {
    const text = stripTags(html).toLowerCase()
    return {
        forms: (structure.forms || []).length,
        buttons: (structure.buttons || []).length,
        auth: /\b(login|sign in|signup|register|session|password|account)\b/.test(text),
        checkout: /\b(checkout|cart|payment|subscription|invoice|billing)\b/.test(text),
        booking: /\b(book|booking|reservation|appointment|calendar|availability)\b/.test(text),
        dashboardCrud: /\b(dashboard|create|edit|update|delete|archive|table|filter)\b/.test(text),
        liveDataClaim: /\b(live|real-time|realtime|synced|production data|connected to)\b/.test(text),
        sampleDataClaim: /\b(sample|demo|placeholder|mock|fake|stub)\b/.test(text),
    }
}

export function emptyQuality() {
    return {
        accessibilityBasics: {
            hasTitle: false,
            hasH1: false,
            hasViewportMeta: false,
            unlabeledControls: [],
            imagesWithoutAlt: [],
        },
        brokenLinkBasics: {
            checked: 0,
            issues: [],
        },
        criticalJourneySignals: {
            forms: 0,
            buttons: 0,
            auth: false,
            checkout: false,
            booking: false,
            dashboardCrud: false,
            liveDataClaim: false,
            sampleDataClaim: false,
        },
        notVerified: [
            'Browser target did not load',
            'Production build output',
            'JavaScript runtime errors',
            'Mobile rendered viewport',
            'Critical journeys',
        ],
    }
}

function parseUrl(value: string) {
    try {
        return new URL(value)
    } catch {
        return null
    }
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
