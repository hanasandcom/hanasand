// @ts-expect-error Bun provides this module when running tests.
import { describe, expect, test } from 'bun:test'
import { isManagementSearchShortcut } from '../src/utils/isManagementSearchShortcut'
import { dispatchManagementSearchShortcut } from '../src/hooks/useManagementSearchShortcut'

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

    test('dispatches accepted shortcuts and prevents their browser default', () => {
        const users = { open: false, focused: false }
        const prevented: boolean[] = []
        const dispatch = (keyEvent: Partial<KeyboardEvent>, onShortcut: () => void, canHandle?: () => boolean) => dispatchManagementSearchShortcut({
            ...event(keyEvent),
            preventDefault: () => prevented.push(true),
        } as KeyboardEvent, onShortcut, canHandle)

        expect(dispatch({ metaKey: true }, () => { users.open = !users.open })).toBe(true)
        expect(users.open).toBe(true)
        expect(dispatch({ ctrlKey: true, key: 'J' }, () => { users.focused = true })).toBe(true)
        expect(users.focused).toBe(true)
        expect(prevented).toHaveLength(2)

        for (const ignored of [
            event(), event({ metaKey: true, key: 'k' }), event({ ctrlKey: true, repeat: true }),
            event({ metaKey: true, altKey: true }), event({ ctrlKey: true, shiftKey: true }),
        ]) {
            expect(dispatch(ignored, () => { users.open = false })).toBe(false)
        }
        expect(users.open).toBe(true)
        expect(prevented).toHaveLength(2)

        let modalSearchCount = 0
        expect(dispatch({ metaKey: true }, () => { modalSearchCount += 1 }, () => false)).toBe(false)
        expect(modalSearchCount).toBe(0)
        expect(prevented).toHaveLength(2)
    })
})
