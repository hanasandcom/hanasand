import type { RawData } from 'ws'

export function socketMessageText(message: RawData) {
    if (Buffer.isBuffer(message)) return message.toString('utf8')
    if (message instanceof ArrayBuffer) return Buffer.from(message).toString('utf8')
    if (Array.isArray(message)) return Buffer.concat(message).toString('utf8')
    return String(message)
}
