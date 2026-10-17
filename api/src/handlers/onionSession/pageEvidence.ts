import type { Page } from 'playwright'
import { submitWebCrackSample } from './webcrack.ts'
import { extractIndicators, extractThreatAssociations, inspectScript, isActionableObfuscatedScript, summarizeDeobfuscationTask } from './analysis.ts'
import { cleanAnalystText } from './providerText.ts'
import type { SandboxDeobfuscationTask, WebCrackLoadResult } from './providerTypes.ts'

export async function loadWebCrackSample(page: Page, tasks: SandboxDeobfuscationTask[]): Promise<WebCrackLoadResult> {
    const task = tasks.find(item => item.sample || item.decodedPreview)
    const sample = (task?.sample || task?.decodedPreview || '').slice(0, 12000)
    if (!task || !sample) {
        return { loaded: false, reason: 'no obfuscated code found on target page' }
    }

    const action = await submitWebCrackSample(page, sample)
    return { loaded: Boolean(action), scriptId: task.scriptId, source: task.source, sampleBytes: Buffer.byteLength(sample), action, reason: action ? undefined : 'WebCrack input editor was not found' }
}

export async function collectRenderedText(page: Page) {
    const domText = await page.evaluate(() => {
        const read = (node: Node): string => {
            const parts: string[] = []
            if (node.nodeType === Node.TEXT_NODE) parts.push(node.textContent || '')
            if (node instanceof HTMLElement || node instanceof SVGElement) {
                const style = window.getComputedStyle(node)
                if (style.display === 'none' || style.visibility === 'hidden') return ''
            }
            const element = node as Element & { shadowRoot?: ShadowRoot }
            if (element.shadowRoot) parts.push(read(element.shadowRoot))
            for (const child of Array.from(node.childNodes)) parts.push(read(child))
            return parts.join(' ')
        }
        return [document.body?.innerText || '', read(document.documentElement)].join(' ').replace(/\s+/g, ' ').trim()
    }).catch(() => '')
    const accessibilityText = await page.context().newCDPSession(page)
        .then(session => session.send('Accessibility.getFullAXTree'))
        .then(tree => (tree.nodes || [])
            .flatMap(node => [node.name?.value, node.value?.value, node.description?.value])
            .filter(Boolean)
            .join(' '))
        .catch(() => '')
    return [domText, accessibilityText].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

export async function collectFastRenderedText(page: Page) {
    return page.evaluate(() => [document.body?.innerText || '', document.documentElement?.textContent || ''].join(' ').replace(/\s+/g, ' ').trim())
        .catch(() => '')
}

export async function collectPageEvidence(page: Page) {
    const snapshot = await page.evaluate(() => {
        const html = document.documentElement?.outerHTML || ''
        const scripts = Array.from(document.scripts).map((script) => ({
            src: script.src || '',
            inline: script.src ? '' : (script.textContent || '').slice(0, 12000),
        }))
        const comments: string[] = []
        const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_COMMENT)
        let node = walker.nextNode()
        while (node && comments.length < 20) {
            const value = node.textContent?.trim()
            if (value) comments.push(value.slice(0, 500))
            node = walker.nextNode()
        }
        const forms = Array.from(document.forms).map((form) => ({
            action: form.action || '',
            method: form.method || 'get',
            inputs: Array.from(form.querySelectorAll('input, textarea, select')).map((input) => {
                const element = input as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
                return {
                    name: element.getAttribute('name') || '',
                    type: element.getAttribute('type') || element.tagName.toLowerCase(),
                    autocomplete: element.getAttribute('autocomplete') || '',
                }
            }).slice(0, 20),
        })).slice(0, 10)
        const anchors = Array.from(document.links).map((link) => link.href).slice(0, 80)

        return {
            sourceCode: html.slice(0, 80_000),
            scripts,
            comments,
            forms,
            anchors,
        }
    }).catch(() => ({
        scripts: [] as Array<{ src: string; inline: string }>,
        comments: [] as string[],
        forms: [] as Array<{ action: string; method: string; inputs: Array<{ name: string; type: string; autocomplete: string }> }>,
        anchors: [] as string[],
        sourceCode: '',
    }))
    const text = await collectRenderedText(page)
    const sourceIndicators = extractIndicators(snapshot.sourceCode)

    const joined = [
        page.url(),
        text,
        snapshot.sourceCode,
        snapshot.comments.join('\n'),
        snapshot.anchors.join('\n'),
        snapshot.forms.map(form => `${form.action} ${form.inputs.map(input => `${input.name}:${input.type}`).join(' ')}`).join('\n'),
        snapshot.scripts.map(script => `${script.src}\n${script.inline}`).join('\n'),
    ].join('\n')
    const scripts = snapshot.scripts.map((script, index) => inspectScript(script, index)).filter(script => script.src || script.sample || script.obfuscationScore > 0)
    const indicators = extractIndicators(joined)
    const obfuscatedScripts = scripts.filter(isActionableObfuscatedScript)
    const deobfuscationTasks = obfuscatedScripts.map(script => summarizeDeobfuscationTask(script))
    const suspiciousDeobfuscationTasks = deobfuscationTasks.filter(task => task.assessment === 'suspicious')
    const forms = snapshot.forms.map(form => ({
        action: form.action,
        method: form.method,
        sensitiveInputCount: form.inputs.filter(input => /pass|token|otp|card|cc|email|user|login/i.test(`${input.name} ${input.type} ${input.autocomplete}`)).length,
        inputCount: form.inputs.length,
    }))
    const suspiciousReasons = [
        suspiciousDeobfuscationTasks.length ? `${suspiciousDeobfuscationTasks.length} suspicious decoded script sample${suspiciousDeobfuscationTasks.length === 1 ? '' : 's'}` : '',
        indicators.ips.length ? `${indicators.ips.length} IP indicator${indicators.ips.length === 1 ? '' : 's'}` : '',
        forms.some(form => form.sensitiveInputCount > 0) ? 'sensitive form fields present' : '',
        /wallet|seed phrase|connect wallet|verify account|install extension|wallet connect/i.test(text) ? 'social-engineering language present' : '',
    ].filter(Boolean)

    return {
        url: page.url(),
        textExcerpt: text.replace(/\s+/g, ' ').trim().slice(0, 900),
        indicators,
        sourceCode: snapshot.sourceCode,
        sourceUrls: sourceIndicators.urls.filter(url => url !== page.url()).slice(0, 40),
        comments: snapshot.comments.map(comment => cleanAnalystText(comment, 500)).filter(Boolean).slice(0, 8),
        communityComments: [] as string[],
        forms,
        scripts,
        obfuscatedScripts,
        verdict: suspiciousReasons.length >= 2 || suspiciousDeobfuscationTasks.length >= 1 ? 'suspicious' : 'unknown',
        confidence: Math.min(95, 35 + suspiciousReasons.length * 15 + suspiciousDeobfuscationTasks.length * 10),
        reasons: suspiciousReasons,
        threatAssociations: extractThreatAssociations(joined, 'rendered_page'),
        deobfuscationTasks,
    }
}

export type PageEvidence = Awaited<ReturnType<typeof collectPageEvidence>>

export function emptyPageEvidence(): Awaited<ReturnType<typeof collectPageEvidence>> {
    return {
        url: '',
        textExcerpt: '',
        indicators: { domains: [], ips: [], urls: [] },
        sourceCode: '',
        sourceUrls: [],
        comments: [],
        communityComments: [],
        forms: [],
        scripts: [],
        obfuscatedScripts: [],
        verdict: 'unknown',
        confidence: 0,
        reasons: ['Page evidence timed out before analysis completed.'],
        threatAssociations: [],
        deobfuscationTasks: [],
    }
}

