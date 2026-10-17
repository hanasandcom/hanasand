// @ts-expect-error Bun supplies this module for focused checks.
import { expect, mock, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

const articles = [{
    id: 'sample-article',
    title: 'Sample article',
    size: 100,
    created: '2025-01-02T00:00:00.000Z',
    modified: '2025-01-03T00:00:00.000Z',
    content: '# Sample article\n\nBody text.',
    metadata: { image: '', description: 'Sample description', wordCount: 20, estimatedMinutes: 1 },
}]

mock.module('../src/utils/articles/staticArticles.json', () => ({ default: articles }))
const { default: Article } = await import('../src/components/articles/article')

test('article detail keeps both styled links to the article index', async () => {
    const html = renderToStaticMarkup(await Article({ id: 'sample-article' }))
    const indexLinks = html.match(/<a\b(?=[^>]*\bhref="\/articles")[^>]*>[\s\S]*?<\/a>/g) || []

    expect(indexLinks).toHaveLength(2)
    expect(indexLinks[0]).toContain('>Articles</a>')
    expect(indexLinks[1]).toContain('>Browse other articles</a>')
    expect(indexLinks.every(link => link.includes('inline-flex w-fit items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm font-semibold text-ui-text transition hover:bg-ui-raised'))).toBe(true)
})
