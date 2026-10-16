import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BrainCircuit, FileText } from 'lucide-react'
import { expect, test } from 'bun:test'
import ContentEditorHeader from '../src/app/dashboard/ContentEditorHeader'

test('article and thought headers keep their labels, titles and delete control', () => {
    const render = (icon: typeof FileText, label: string, title: string) => renderToStaticMarkup(
        createElement(ContentEditorHeader, { icon, label, title, onDelete: () => undefined }),
    )
    const article = render(FileText, 'Article editor', 'Editing launch-notes')
    const thought = render(BrainCircuit, 'Thought editor', 'Editing thought')

    for (const html of [article, thought]) {
        expect(html).toContain('class="flex items-center justify-between gap-3"')
        expect(html).toContain('class="min-w-0"')
        expect(html).toContain('class="mt-2 truncate text-xl font-medium text-ui-text"')
        expect(html).toContain('type="button"')
        expect(html).toContain('>Delete</button>')
    }
    expect(article).toContain('Article editor')
    expect(article).toContain('Editing launch-notes')
    expect(thought).toContain('Thought editor')
    expect(thought).toContain('Editing thought')
})
