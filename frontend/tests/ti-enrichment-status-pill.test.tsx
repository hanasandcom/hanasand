import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'bun:test'
import { StatusPill, workerStatusTone } from '../src/app/dashboard/ti/dashboardPresentation'

describe('TI worker state tone', () => {
    it('maps active, unavailable, and all other states consistently', () => {
        expect(workerStatusTone('active')).toBe('ok')
        expect(workerStatusTone('unavailable')).toBe('bad')
        expect(workerStatusTone('idle')).toBe('watch')
        expect(workerStatusTone('queued')).toBe('watch')
    })
})

describe('compact TI status pill', () => {
    it('matches the enrichment pill markup for healthy and unavailable worker states', () => {
        expect(renderToStaticMarkup(<StatusPill compact label='worker ready' tone='ok' />)).toBe(
            '<span class="rounded-full border px-2 py-0.5 text-xs font-semibold border-ui-success/35 bg-ui-success/10 text-ui-success">worker ready</span>',
        )
        expect(renderToStaticMarkup(<StatusPill compact label='worker unavailable' tone='bad' />)).toBe(
            '<span class="rounded-full border px-2 py-0.5 text-xs font-semibold border-ui-danger/35 bg-ui-raised/10 text-ui-text">worker unavailable</span>',
        )
    })

    it('keeps the default pill markup unchanged for every tone', () => {
        const cases = [
            ['neutral', 'bg-ui-panel border border-ui-border text-ui-primary'],
            ['ok', 'bg-ui-success/10 border border-ui-success/35 text-ui-success'],
            ['watch', 'bg-ui-warning/10 border border-ui-warning/35 text-ui-warning'],
            ['bad', 'bg-ui-raised/10 border border-ui-danger/35 text-ui-text'],
        ] as const

        for (const [tone, classes] of cases) {
            expect(renderToStaticMarkup(<StatusPill label='state' tone={tone} />)).toBe(
                `<span class="whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${classes}">state</span>`,
            )
        }
    })
})
