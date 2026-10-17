import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, mock, test } from 'bun:test'
import { BrainCircuit, FilePlus2 } from 'lucide-react'

mock.module('@/components/editor/editor', () => ({
    default: ({ id, content, className, customSaveLogic, hideSaveButton }: {
        id: string
        content: string[]
        className: string
        customSaveLogic: boolean
        hideSaveButton: boolean
    }) => createElement('textarea', {
        'data-editor-id': id,
        'data-editor-content': content.join('|'),
        'data-custom-save-logic': String(customSaveLogic),
        'data-hide-save-button': String(hideSaveButton),
        className,
        value: content.join('\n'),
        readOnly: true,
    }),
}))
mock.module('@/components/error/errorNotice', () => ({
    default: ({ message }: { message?: string | null }) => message ? createElement('p', null, message) : null,
}))
mock.module('@/utils/articles/fetchArticle', () => ({ default: async () => null }))
mock.module('@/utils/articles/postArticle', () => ({ postArticle: async () => ({ status: 201, message: 'created' }) }))
mock.module('@/utils/thoughts/fetchThoughtByTitle', () => ({ default: async () => [] }))
mock.module('@/utils/thoughts/postThought', () => ({ postThought: async () => ({ status: 201, message: 'created' }) }))
mock.module('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }) }))

const [{ default: CreateArticle }, { default: CreateThought }] = await Promise.all([
    import('../src/app/dashboard/articles/create/pageClient'),
    import('../src/app/dashboard/thoughts/create/pageClient'),
])
const { default: CreateContentEditor } = await import('../src/app/dashboard/CreateContentEditor')

test('article and thought create pages retain their labels and editor contracts', () => {
    const article = renderToStaticMarkup(createElement(CreateArticle))
    const thought = renderToStaticMarkup(createElement(CreateThought))

    for (const html of [article, thought]) {
        expect(html).toContain('class="relative grid gap-4 px-4 md:px-[18vw]"')
        expect(html).toContain('type="button"')
        expect(html).toContain('>Create</button>')
        expect(html).toContain('data-editor-id=""')
        expect(html).toContain('data-editor-content=""')
        expect(html).toContain('data-custom-save-logic="true"')
        expect(html).toContain('data-hide-save-button="true"')
        expect(html).toContain('rounded-lg border border-ui-border bg-ui-raised p-2 shadow-sm shadow-ui-canvas/20')
    }

    expect(article).toContain('Article editor')
    expect(article).toContain('data-editor-id=""')
    expect(article).toContain('class="grid w-full gap-4"')
    expect(thought).toContain('Thought editor')
    expect(thought).toContain('class="grid w-full gap-5"')
})

test('non-empty create presentations preserve per-page fields, editor values, and layout', () => {
    const article = renderToStaticMarkup(createElement(CreateContentEditor, {
        icon: FilePlus2,
        label: 'Article editor',
        title: 'Creating release-notes',
        error: null,
        editing: true,
        setEditing: () => undefined,
        id: 'release-notes.md',
        content: ['Release notes', 'First line'],
        onChange: () => undefined,
        onCreate: () => undefined,
        editorGap: 'gap-4',
    }, createElement('div', { className: 'grid gap-2' },
        createElement('label', { htmlFor: 'article-id' }, 'Article ID'),
        createElement('input', { id: 'article-id', value: 'release-notes.md', readOnly: true }),
    )))
    const thought = renderToStaticMarkup(createElement(CreateContentEditor, {
        icon: BrainCircuit,
        label: 'Thought editor',
        title: 'Creating thought',
        error: null,
        editing: false,
        setEditing: () => undefined,
        id: 'Why does this happen?',
        content: ['Why does this happen?', 'A short thought.'],
        onChange: () => undefined,
        onCreate: () => undefined,
        editorGap: 'gap-5',
    }))

    expect(article).toContain('Creating release-notes')
    expect(article).toContain('class="relative grid gap-4 "')
    expect(article).toContain('class="grid w-full gap-4"')
    expect(article).toContain('value="release-notes.md"')
    expect(article).toContain('data-editor-id="release-notes.md"')
    expect(article).toContain('data-editor-content="Release notes|First line"')
    expect(article.indexOf('Article ID')).toBeLessThan(article.indexOf('data-editor-id='))

    expect(thought).toContain('Creating thought')
    expect(thought).toContain('class="relative grid gap-4 px-4 md:px-[18vw]"')
    expect(thought).toContain('class="grid w-full gap-5"')
    expect(thought).toContain('data-editor-id="Why does this happen?"')
    expect(thought).toContain('data-editor-content="Why does this happen?|A short thought."')
    expect(thought).not.toContain('Article ID')
})
