import net from 'node:net'

export type SocksConnect = {
    host: string
    port: number
}

export function createSocksServer(targetHost: string, targetBody: string, connects: SocksConnect[]) {
    return net.createServer((socket) => {
        let buffer = Buffer.alloc(0)
        let greeted = false
        let connectedToTarget = false

        socket.on('data', (chunk) => {
            buffer = Buffer.concat([buffer, typeof chunk === 'string' ? Buffer.from(chunk) : chunk])
            if (connectedToTarget) {
                if (!buffer.includes(Buffer.from('\r\n\r\n'))) return
                socket.write([
                    'HTTP/1.1 200 OK',
                    'content-type: text/html; charset=utf-8',
                    'cache-control: no-store',
                    `content-length: ${Buffer.byteLength(targetBody)}`,
                    '',
                    targetBody,
                ].join('\r\n'))
                socket.end()
                buffer = Buffer.alloc(0)
                return
            }

            if (!greeted) {
                if (buffer.length < 2) return
                const methodCount = buffer[1] || 0
                if (buffer.length < 2 + methodCount) return
                socket.write(Buffer.from([0x05, 0x00]))
                buffer = buffer.subarray(2 + methodCount)
                greeted = true
            }

            if (greeted && buffer.length >= 7) handleConnectRequest(buffer)
        })

        function handleConnectRequest(data: Buffer) {
            const request = parseSocksConnect(data)
            if (!request) return
            connects.push(request)
            buffer = Buffer.alloc(0)
            if (request.host === targetHost && request.port === 80) {
                connectedToTarget = true
                socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0x7f, 0x00, 0x00, 0x01, 0x1f, 0x90]))
                return
            }
            socket.write(Buffer.from([0x05, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))
            socket.end()
        }
    })
}

function parseSocksConnect(buffer: Buffer): SocksConnect | null {
    if (buffer[0] !== 0x05 || buffer[1] !== 0x01) return null
    const addressType = buffer[3]
    let offset = 4
    let host: string
    if (addressType === 0x01) {
        if (buffer.length < offset + 4 + 2) return null
        host = Array.from(buffer.subarray(offset, offset + 4)).join('.')
        offset += 4
    } else if (addressType === 0x03) {
        const length = buffer[offset]
        if (typeof length !== 'number' || buffer.length < offset + 1 + length + 2) return null
        host = buffer.subarray(offset + 1, offset + 1 + length).toString('utf8')
        offset += 1 + length
    } else if (addressType === 0x04) {
        if (buffer.length < offset + 16 + 2) return null
        host = buffer.subarray(offset, offset + 16).toString('hex')
        offset += 16
    } else {
        return null
    }
    return { host, port: buffer.readUInt16BE(offset) }
}
