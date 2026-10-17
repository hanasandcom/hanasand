import { expect, test } from 'bun:test'
import { isOpenFilesCloseShortcut } from '../src/components/share/files/openFiles'

test('open-file close shortcut supports option-w and the macOS omega key', () => {
    expect(isOpenFilesCloseShortcut({ key: 'w', altKey: true })).toBe(true)
    expect(isOpenFilesCloseShortcut({ key: 'Ω', altKey: false })).toBe(true)
    expect(isOpenFilesCloseShortcut({ key: 'ω', altKey: false })).toBe(true)
    expect(isOpenFilesCloseShortcut({ key: 'w', altKey: false })).toBe(false)
    expect(isOpenFilesCloseShortcut({ key: 'w', altKey: false, metaKey: true })).toBe(false)
})
