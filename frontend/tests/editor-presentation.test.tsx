// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { EditorWithoutLogic } from '../src/components/editor/editorPresentation'

function renderEditor(overrides: Partial<Parameters<typeof EditorWithoutLogic>[0]> = {}) {
    return renderToStaticMarkup(<EditorWithoutLogic
        markdown='# Draft'
        handleMarkdownChange={() => {}}
        handleSave={() => {}}
        displayEditor
        handleDisplayEditor={() => {}}
        hideSave={false}
        textareaRef={{ current: null }}
        edited
        {...overrides}
    />)
}

test('markdown editor renders matching editor and preview content with save control', () => {
    const html = renderEditor()
    expect(html).toContain('Markdown')
    expect(html).toContain('Preview')
    expect(html).toContain('># Draft</textarea>')
    expect(html).toContain('<h1>Draft</h1>')
    expect(html).toContain('>Save</button>')
})

test('read-only preview omits editor and save controls', () => {
    const html = renderEditor({ displayEditor: false, edited: false })
    expect(html).not.toContain('<textarea')
    expect(html).not.toContain('>Save</button>')
    expect(html).toContain('<h1>Draft</h1>')
})
