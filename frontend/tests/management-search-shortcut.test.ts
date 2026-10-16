// @ts-expect-error Bun provides this module when running tests.
import { describe, expect, test } from 'bun:test'
import { isManagementSearchShortcut } from '../src/utils/isManagementSearchShortcut'

describe('management search shortcut', () => {
    const event = (overrides: Partial<KeyboardEvent> = {}) => ({
        metaKey: false,
        ctrlKey: false,
        key: 'j',
        repeat: false,
        altKey: false,
        shiftKey: false,
        ...overrides,
    }) as KeyboardEvent

    test('accepts Cmd or Ctrl plus J regardless of letter case', () => {
        expect(isManagementSearchShortcut(event({ metaKey: true }))).toBe(true)
        expect(isManagementSearchShortcut(event({ ctrlKey: true, key: 'J' }))).toBe(true)
    })

    test('rejects unrelated and modified key presses', () => {
        expect(isManagementSearchShortcut(event())).toBe(false)
        expect(isManagementSearchShortcut(event({ metaKey: true, key: 'k' }))).toBe(false)
        expect(isManagementSearchShortcut(event({ ctrlKey: true, repeat: true }))).toBe(false)
        expect(isManagementSearchShortcut(event({ metaKey: true, altKey: true }))).toBe(false)
        expect(isManagementSearchShortcut(event({ ctrlKey: true, shiftKey: true }))).toBe(false)
    })
})
