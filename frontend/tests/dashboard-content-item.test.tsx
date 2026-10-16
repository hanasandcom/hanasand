import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, mock, test } from 'bun:test'

let shiftPressed = false
mock.module('../src/hooks/keyPressed', () => ({ default: () => ({ shift: shiftPressed }) }))
mock.module('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }) }))

const {
    default: DashboardContentItem,
    dashboardContentPath,
    dashboardContentDeletedMessage,
} = await import('../src/components/dashboard/dashboardContentItem')

function render(kind: 'article' | 'thought', id: string, title: string) {
    return renderToStaticMarkup(createElement(DashboardContentItem, { kind, id, title }))
}

test('article and thought rows preserve route targets, titles and shift-delete presentation', () => {
    expect(dashboardContentPath('article', 'guide.md')).toBe('/articles/guide.md')
    expect(dashboardContentPath('thought', 'idea-1')).toBe('/thought/idea-1')
    expect(dashboardContentDeletedMessage('article', 'guide.md')).toBe('Deleted article guide.md.')
    expect(dashboardContentDeletedMessage('thought', 'idea-1')).toBe('Deleted thought idea-1.')

    shiftPressed = false
    const article = render('article', 'guide.md', 'Guide')
    const thought = render('thought', 'idea-1', '')
    expect(article).toContain('Guide')
    expect(article).toContain('file-text')
    expect(thought).toContain('idea-1')
    expect(thought).toContain('brain-circuit')
    expect(article).toContain('text-ui-text hover:bg-ui-raised')
    expect(article).not.toContain('border-ui-danger/40')

    shiftPressed = true
    const deleteArticle = render('article', 'guide.md', 'Guide')
    const deleteThought = render('thought', 'idea-1', 'Idea')
    expect(deleteArticle).toContain('border-ui-danger/40 bg-ui-raised/10')
    expect(deleteThought).toContain('border-ui-danger/40 bg-ui-raised/10')
    expect(deleteArticle).toContain('text-ui-text')
    expect(deleteThought).toContain('text-ui-text')
})
