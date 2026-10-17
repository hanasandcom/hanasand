// @ts-expect-error Bun provides this module when running tests.
import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ScannerSolutionPage from '../src/app/solutions/scanner/page'
import MonitoringSolutionPage from '../src/app/solutions/security-monitoring/page'

describe('solution feature cards', () => {
    test.each([
        [ScannerSolutionPage, [
            ['Actionable results', 'Review passed, warned, and failed controls with severity and target context.'],
            ['Historical runs', 'Compare current and previous scan durations, findings, and errors.'],
            ['Always scheduled', 'Keep the Hanasand organization scanning continuously with an adjustable cadence.'],
        ]],
        [MonitoringSolutionPage, [
            ['One endpoint', 'Send JSON events using an organization API key.'],
            ['Useful first detections', 'Start with repeated failures, new countries, and geographically incompatible logins.'],
            ['Evidence-first review', 'Inspect the matching events, rule ID, source context, and original event sample.'],
        ]],
    ] as const)('keeps feature content and card presentation', (Page, features) => {
        const html = renderToStaticMarkup(createElement(Page))

        expect((html.match(/<article class="grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-4">/g) ?? []).length).toBe(3)
        for (const [title, detail] of features) {
            expect(html).toContain(`<h2 class="font-semibold">${title}</h2>`)
            expect(html).toContain(`<p class="text-sm leading-6 text-ui-muted">${detail}</p>`)
        }
    })
})
