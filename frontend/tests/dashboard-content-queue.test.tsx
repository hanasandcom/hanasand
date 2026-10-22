// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DashboardContentQueue } from '../src/components/dashboard/dashboardContentQueue'
import { DashboardPublishingEmptyState } from '../src/components/dashboard/dashboardPublishingEmptyState'
import { DashboardPublishingPage } from '../src/components/dashboard/dashboardPublishingPage'
import { DashboardPage } from 'hanasand/dashboard'

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

test('publishing page shows only the empty state or the populated metrics and queue', () => {
    const emptyState = createElement('div', null, 'Empty state')
    const metrics = createElement('section', null, 'Metrics')
    const queue = createElement('section', null, 'Queue')
    for (const hasContent of [false, true]) {
        let renderCount = 0
        const actual = renderToStaticMarkup(createElement(DashboardPublishingPage, {
            hasContent,
            emptyState,
            renderContent: () => {
                renderCount += 1
                return createElement('div', null, metrics, queue)
            },
        }))
        const expected = renderToStaticMarkup(createElement(DashboardPage, null,
            !hasContent ? emptyState : null,
            hasContent ? createElement('div', null, metrics, queue) : null,
        ))

        expect(actual).toBe(expected)
        expect(renderCount).toBe(hasContent ? 1 : 0)
    }
})

test('article and thought empty states share the same panel and preserve their distinct copy and action', () => {
    const cases = [
        {
            title: 'Publish your first article',
            description: 'Turn research into a clear public update and start the editorial queue.',
            href: '/content/articles/create',
            action: createElement('a', { href: '/content/articles/create', className: 'mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-on-primary' }, 'Create your first article'),
            actionClass: 'mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-on-primary',
        },
        {
            title: 'Create your first thought',
            description: undefined,
            href: '/content/thoughts/create',
            action: createElement('div', { className: 'mt-5 flex justify-center gap-2' }, createElement('a', { href: '/content/thoughts/create', className: 'inline-flex h-9 items-center gap-2 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-on-primary' }, 'Create')),
            actionClass: 'inline-flex h-9 items-center gap-2 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-on-primary',
            actionWrapper: 'mt-5 flex justify-center gap-2',
        },
    ]

    for (const item of cases) {
        const html = renderToStaticMarkup(createElement(DashboardPublishingEmptyState, {
            icon: createElement('span', { className: 'h-6 w-6' }),
            title: item.title,
            description: item.description,
            action: item.action,
        }))

        expect(html).toContain('min-h-80 place-items-center border-ui-border bg-ui-panel p-8 text-center')
        expect(html).toContain('bg-ui-primary/10 text-ui-primary')
        expect(html).toContain(`>${item.title}</h2>`)
        expect(html).toContain(`href="${item.href}"`)
        expect(html).toContain(`class="${item.actionClass}"`)
        if (item.actionWrapper) expect(html).toContain(`class="${item.actionWrapper}"`)
        if (item.description) expect(html).toContain(`>${item.description}</p>`)
        else expect(html).not.toContain('<p class="mt-2 text-sm leading-6 text-ui-muted">')
    }
})
