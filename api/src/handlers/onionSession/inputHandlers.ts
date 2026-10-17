import { clampNumber } from '../../utils/numbers.ts'
import { isCopyShortcut, isPasteShortcut, isSelectAllShortcut, keyShortcut, mouseButton, normalizeKey, type BrokerMessage } from './protocol.ts'
import type { SessionState } from './sessionState.ts'

export function createInputService(state: SessionState) {
    async function handlePointer(message: BrokerMessage) {
        if (!state.page) return
        const x = clampNumber(message.x, 0, 2400, 0)
        const y = clampNumber(message.y, 0, 1600, 0)
        if (message.type === 'click') {
            await state.page.mouse.click(x, y, { button: mouseButton(message.button) })
        } else {
            await state.page.mouse.move(x, y)
            if (message.event === 'pointerdown') {
                await state.page.mouse.down({ button: mouseButton(message.button) }).catch(() => undefined)
            } else if (message.event === 'pointerup') {
                await state.page.mouse.up({ button: mouseButton(message.button) }).catch(() => undefined)
            } else if (message.buttons) {
                await state.page.mouse.down({ button: mouseButton(message.button) }).catch(() => undefined)
            }
        }
    }

    async function handleWheel(message: BrokerMessage) {
        if (!state.page) return
        const deltaX = clampNumber(message.deltaX, -1600, 1600, 0)
        const deltaY = clampNumber(message.deltaY, -1600, 1600, 0)
        if (typeof message.x === 'number' && typeof message.y === 'number') {
            await state.page.mouse.move(clampNumber(message.x, 0, 2400, 0), clampNumber(message.y, 0, 1600, 0)).catch(() => undefined)
        }
        await state.page.mouse.wheel(deltaX, deltaY)
    }

    async function handleKey(message: BrokerMessage) {
        if (!state.page || !message.key) return
        const shortcut = keyShortcut(message)
        if (isPasteShortcut(message) && state.remoteClipboard) {
            state.editableSelectAllArmed = false
            await state.page.keyboard.insertText(state.remoteClipboard)
        } else if (isSelectAllShortcut(message) && await selectEditableText()) {
            state.editableSelectAllArmed = true
            // The client may be on macOS while the remote browser is Linux-like; normalize select-all in editable fields.
        } else if (shortcut) {
            let selectedText = isCopyShortcut(message) ? await readSelectedText() : ''
            if (isCopyShortcut(message) && !selectedText && state.editableSelectAllArmed) {
                selectedText = await readEditableValue()
            }
            await state.page.keyboard.press(shortcut).catch(() => undefined)
            if (isCopyShortcut(message)) {
                const copiedText = await readSelectedText() || selectedText
                if (copiedText) state.remoteClipboard = copiedText
            }
            state.editableSelectAllArmed = false
        } else if (message.key.length === 1) {
            state.editableSelectAllArmed = false
            await state.page.keyboard.insertText(message.key)
        } else {
            state.editableSelectAllArmed = false
            await state.page.keyboard.press(normalizeKey(message.key)).catch(() => undefined)
        }
    }

    async function readRemoteClipboard() {
        if (!state.page) return ''
        const browserClipboard = await state.page.evaluate(() => navigator.clipboard?.readText?.().catch(() => '') || '').catch(() => '')
        return state.remoteClipboard || browserClipboard
    }

    async function readSelectedText() {
        if (!state.page) return state.remoteClipboard
        const selected = await state.page.evaluate(() => {
            const active = document.activeElement
            if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
                const start = active.selectionStart ?? 0
                const end = active.selectionEnd ?? 0
                return active.value.slice(Math.min(start, end), Math.max(start, end))
            }

            return window.getSelection()?.toString() || ''
        }).catch(() => '')

        return selected
    }

    async function selectEditableText() {
        if (!state.page) return false
        return await state.page.evaluate(() => {
            const active = document.activeElement
            if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
                active.select()
                return true
            }

            return false
        }).catch(() => false)
    }

    async function readEditableValue() {
        if (!state.page) return ''
        return await state.page.evaluate(() => {
            const active = document.activeElement
            if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
                return active.value
            }

            return ''
        }).catch(() => '')
    }

    return { handlePointer, handleWheel, handleKey, readRemoteClipboard }
}
