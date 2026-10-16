import { describe, expect, test } from 'bun:test'
import { parseTerminalContent } from '../src/components/share/terminalOutput'

describe('terminal output normalization', () => {
    test('unwraps JSON content and normalizes line endings', () => {
        expect(parseTerminalContent(JSON.stringify({ content: 'first\r\nsecond\n' })))
            .toBe('first\r\nsecond\r\n')
    })

    test('removes shell startup noise while preserving command output', () => {
        const output = 'ready\nbash: no job control in this shell\n$ ls\nsudo: unable to resolve host demo'
        expect(parseTerminalContent(output)).toBe('ready\r\n$ ls')
    })

    test('handles malformed JSON as ordinary terminal text', () => {
        expect(parseTerminalContent('{partial\nline')).toBe('{partial\r\nline')
    })
})
