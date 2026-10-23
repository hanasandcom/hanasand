import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ErrorsPanel from '../src/app/dashboard/logs/errorsPanel'
import { emptyErrorEvents, type ErrorEvent, type ErrorEventsResponse } from '../src/utils/logs/errorEvents'

const row: ErrorEvent = { id: 'synthetic', source: 'api', service: 'synthetic', surface: 'api', method: 'GET', path: '/synthetic-visible-error', status_code: 500, error_code: 'synthetic-failure', message: 'Synthetic error', request_id: '', user_id: '', level: 'error', created_at: '2026-10-23T10:00:00Z' }
const render = (events: ErrorEventsResponse) => renderToStaticMarkup(createElement(ErrorsPanel, { events, expanded: {}, onToggle: () => {}, onCopy: () => {} }))

test('unavailable historical summary retains recent errors without invented zeros', () => {
    const html = render({ ...emptyErrorEvents(), errors: [row], summary_warning: 'Synthetic historical totals unavailable.', summary_checked_at: '2026-10-23T10:00:00Z' })
    expect(html).toContain('synthetic-visible-error')
    expect(html).toContain('Synthetic historical totals unavailable.')
    expect(html).toContain('Checked')
    expect(html).toContain('Unavailable')
    expect(html).not.toContain('from 0 errors')
    expect(html).not.toContain('No errors in this window.')
})

test('verified zero counts render as zero and keep their exact availability', () => {
    const html = render({ generated_at: '', errors: [], summary_available: true, summary: { total: 0, last_hour: 0, last_24h: 0, server_errors: 0, client_errors: 0, status_counts: [], surface_counts: [], code_counts: [] } })
    expect(html).toContain('from 0 errors')
    expect(html).not.toContain('data-logs-summary-unavailable')
    expect(html).toContain('No errors in this window.')
})

test('an unloaded response does not claim there are no tracked errors', () => {
    const html = render(emptyErrorEvents())
    expect(html).toContain('Recent error records have not loaded yet.')
    expect(html).not.toContain('No tracked errors in the current window.')
})
