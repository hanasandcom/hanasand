// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import DatabaseInventory from '../src/app/dashboard/db/databaseInventory'

test('database inventory renders the supplied database and storage measurements', () => {
    const html = renderToStaticMarkup(<DatabaseInventory instances={[{
        id: 'primary',
        engine: 'PostgreSQL',
        status: 'healthy',
        databases: [{ name: 'customer-data', sizeBytes: 1000, connections: 4, tableCount: 8, tables: [] }],
    }]} stale={false} />)

    expect(html).toContain('customer-data')
    expect(html).toContain('PostgreSQL')
    expect(html).toContain('Healthy')
    expect(html).toContain('1.00 KB')
    expect(html).toContain('aria-label="Databases"')
})
