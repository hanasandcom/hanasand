import { expect, test } from 'bun:test'
import { socketMessageText } from '../src/utils/ws/socketMessageText.ts'

test('decodes websocket raw data from Buffer, ArrayBuffer, and Buffer chunks', () => {
    expect(socketMessageText(Buffer.from('buffer payload'))).toBe('buffer payload')
    expect(socketMessageText(Uint8Array.from(Buffer.from('array buffer payload')).buffer)).toBe('array buffer payload')
    expect(socketMessageText([Buffer.from('buffer '), Buffer.from('chunks')])).toBe('buffer chunks')
})
