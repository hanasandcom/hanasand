import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import BlocklistClient from '../src/app/dashboard/traffic/blocklist/blocklistClient'

test('blocklist edit and delete actions require a persisted entry id', () => {
    const html = renderToStaticMarkup(createElement(BlocklistClient, {
        initialBlocklist: [
            { id: 7, type: 'ip', value: '192.0.2.1' },
            { type: 'user_agent', value: 'fixture agent' },
        ],
    }))
    const missingIdRow = html.match(/<tr[^>]*>.*?fixture agent.*?<\/tr>/)?.[0]
    const persistedIdRow = html.match(/<tr[^>]*>.*?192\.0\.2\.1.*?<\/tr>/)?.[0]

    expect(missingIdRow).toContain('disabled=""')
    expect((missingIdRow?.match(/disabled=""/g) || []).length).toBe(2)
    expect(persistedIdRow).not.toContain('disabled=""')
})
