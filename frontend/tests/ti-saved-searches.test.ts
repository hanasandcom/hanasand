import assert from 'node:assert/strict'
import { createElement, type ReactElement, type ReactNode, type SyntheticEvent } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { test } from 'bun:test'
import SearchWorkspaceControls from '../src/app/ti/components/search-workspace-controls'
import { addSavedSearch, parseSavedSearches, persistSavedSearches, removeSavedSearch, TI_SAVED_SEARCHES_KEY, TI_SAVED_SEARCH_LIMIT, type SavedSearch } from '../src/app/ti/savedSearches'

const fixture = (count: number): SavedSearch[] => Array.from({ length: count }, (_, index) => ({
    query: `Search ${index}`,
    savedAt: `2026-10-18T00:00:${String(index).padStart(2, '0')}.000Z`,
}))

function elements(node: ReactNode): ReactElement<{ children?: ReactNode; onClick?: () => void; title?: string; 'aria-label'?: string }>[] {
    if (Array.isArray(node)) return node.flatMap(elements)
    if (!node || typeof node !== 'object' || !('props' in node)) return []
    const element = node as ReactElement<{ children?: ReactNode; onClick?: () => void; title?: string; 'aria-label'?: string }>
    return [element, ...elements(element.props.children)]
}

test('saved-search policy validates, caps, deduplicates, and removes entries', () => {
    const stored = [...fixture(9), { query: 'invalid', savedAt: 2 }, null]
    const loaded = parseSavedSearches(stored)

    assert.equal(TI_SAVED_SEARCHES_KEY, 'hanasand:ti:saved-searches')
    assert.equal(TI_SAVED_SEARCH_LIMIT, 8)
    assert.deepEqual(loaded.map(item => item.query), fixture(8).map(item => item.query))
    assert.deepEqual(parseSavedSearches('not an array'), [])
    assert.deepEqual(parseSavedSearches([{ query: 'Legacy account search' }], true), [{ query: 'Legacy account search' }])
    assert.deepEqual(parseSavedSearches([{ query: 'Legacy browser search' }]), [])

    const duplicate = addSavedSearch(loaded, 'SEARCH 2', 'now')
    assert.equal(duplicate[0].query, 'SEARCH 2')
    assert.equal(duplicate.filter(item => item.query.toLowerCase() === 'search 2').length, 1)
    const updated = addSavedSearch(loaded, 'New query', 'later')
    assert.equal(updated.length, 8)
    assert.equal(updated[0].query, 'New query')
    assert.equal(updated.some(item => item.query === 'Search 7'), false)
    assert.deepEqual(removeSavedSearch(updated, 'New query').map(item => item.query), fixture(7).map(item => item.query))

    const writes: Array<[string, string]> = []
    persistSavedSearches({ setItem: (key, value) => writes.push([key, value]) }, updated)
    assert.deepEqual(writes, [[TI_SAVED_SEARCHES_KEY, JSON.stringify(updated)]])
})

test('saved-search controls render the browser notice and wire reopen and remove actions', () => {
    const reopened: string[] = []
    const removed: string[] = []
    const props = {
        query: 'APT29',
        busy: false,
        visible: false,
        error: '',
        hasUsableResult: false,
        savedSearches: [{ query: 'APT29', savedAt: '2026-10-18T00:00:00.000Z' }],
        savedSearchesFromAccount: false,
        savedSearchError: '',
        onSubmit: (event: SyntheticEvent<HTMLFormElement>) => event.preventDefault(),
        onQueryChange: () => {},
        onSearch: (query: string) => reopened.push(query),
        onSave: () => {},
        onRemoveSavedSearch: (query: string) => removed.push(query),
    }
    const tree = SearchWorkspaceControls(props)
    const markup = renderToStaticMarkup(createElement(SearchWorkspaceControls, props))
    const buttons = elements(tree).filter(element => element.type === 'button')
    const open = buttons.find(element => element.props.title === 'Open APT29')
    const remove = buttons.find(element => element.props['aria-label'] === 'Remove saved search APT29')

    assert.match(markup, /Stored only in this browser until you sign in\./)
    assert.match(markup, /title="Open APT29"/)
    assert.match(markup, /aria-label="Remove saved search APT29"/)
    assert.equal(typeof open?.props.onClick, 'function')
    assert.equal(typeof remove?.props.onClick, 'function')
    open?.props.onClick?.()
    remove?.props.onClick?.()
    assert.deepEqual(reopened, ['APT29'])
    assert.deepEqual(removed, ['APT29'])

    const accountMarkup = renderToStaticMarkup(createElement(SearchWorkspaceControls, { ...props, savedSearchesFromAccount: true }))
    assert.match(accountMarkup, /Stored with your account\./)
})
