import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { TreeItemDeleteDialog } from '../src/components/share/tree/treeItemDeleteDialog'

const noop = () => {}

test('file deletion asks for confirmation with share-specific copy', () => {
    const html = renderToStaticMarkup(<TreeItemDeleteDialog
        kind='file'
        name='report.md'
        open
        onCancel={noop}
        onConfirm={noop}
    />)

    expect(html).toContain('role="dialog" aria-modal="true"')
    expect(html).toContain('Delete report.md?')
    expect(html).toContain('This file will be deleted from the share.')
    expect(html).toContain('>Delete</button>')
})

test('folder deletion warns that its contents will also be deleted', () => {
    const html = renderToStaticMarkup(<TreeItemDeleteDialog
        kind='folder'
        name='docs'
        open
        onCancel={noop}
        onConfirm={noop}
    />)

    expect(html).toContain('Delete docs?')
    expect(html).toContain('Everything inside this folder will be deleted.')
    expect(html).toContain('>Delete</button>')
})

test('closed tree deletion dialog renders nothing', () => {
    expect(renderToStaticMarkup(<TreeItemDeleteDialog
        kind='file'
        name='report.md'
        open={false}
        onCancel={noop}
        onConfirm={noop}
    />)).toBe('')
})
