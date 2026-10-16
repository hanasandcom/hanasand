// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DashboardContentQueue } from '../src/components/dashboard/dashboardContentQueue'

test('article and thought queues retain their shared panel markup and page rows', () => {
    const cases = [
        { title: 'Editorial queue', description: 'Newest articles are streaming here.', count: 2, href: '/content/articles/one', row: 'Article title' },
        { title: 'Thoughts', description: 'Recent philosophical questions.', count: 3, href: '/content/thoughts/one', row: 'Thought title' },
    ]

    for (const item of cases) {
        const html = renderToStaticMarkup(createElement(
            DashboardContentQueue,
            { title: item.title, description: item.description, count: item.count },
            createElement('a', { href: item.href }, item.row),
        ))

        expect(html).toContain(`>${item.title}</h2>`)
        expect(html).toContain(`>${item.description}</p>`)
        expect(html).toContain(`>${item.count} rows</span>`)
        expect(html).toContain(`href="${item.href}"`)
        expect(html).toContain(item.row)
        expect(html).toContain('grid gap-1 p-3')
        expect(html).toContain('border-b border-ui-border bg-ui-panel px-4 py-3')
    }
})
