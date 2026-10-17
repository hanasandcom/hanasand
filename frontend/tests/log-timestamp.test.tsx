// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { LogTimestamp } from '../src/app/dashboard/logs/LogTimestamp'

test('log timestamps retain local display text and expose their source value semantically', () => {
    const value = '2026-09-24T12:00:00.000Z'
    const html = renderToStaticMarkup(<LogTimestamp value={value} />)

    expect(html).toBe(`<time dateTime="${value}">${new Date(value).toLocaleString()}</time>`)
})
