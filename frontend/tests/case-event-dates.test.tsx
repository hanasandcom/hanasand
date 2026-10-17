// @ts-expect-error Bun provides this module when running focused tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CaseEvents, type CaseEvent } from '../src/app/dashboard/cases/case-events'
import { date } from '../src/app/dashboard/cases/monitoringCaseText'

test('case event dates reuse the shared formatter and preserve missing labels', () => {
    const startedAt = '2026-10-17T08:30:00.000Z'
    const html = renderToStaticMarkup(createElement(CaseEvents, {
        events: [{ id: 'event-1', startedAt, outcome: 'failed', message: 'Check failed.' } as CaseEvent],
        total: 1,
        occurrences: 1,
        loading: false,
        onMore: () => {},
    }))

    expect(date()).toBe('—')
    expect(html).toContain(`<p class="font-medium">${new Date(startedAt).toLocaleString()} · failed</p>`)
    expect(html).toContain('<div><dt>Completed</dt><dd>Not recorded</dd></div>')
    expect(html).toContain('Each event is one check run that contributed to this case.')
})
