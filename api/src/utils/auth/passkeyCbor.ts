export function readCbor(data: Buffer) {
    return new CborReader(data).read()
}

export function mapGetBuffer(map: Map<unknown, unknown>, key: unknown) {
    const value = map.get(key)
    if (!Buffer.isBuffer(value)) {
        throw new Error(`Passkey CBOR field ${String(key)} was missing.`)
    }
    return value
}

export function mapGetNumber(map: Map<unknown, unknown>, key: unknown) {
    const value = map.get(key)
    if (typeof value !== 'number') {
        throw new Error(`Passkey CBOR numeric field ${String(key)} was missing.`)
    }
    return value
}

class CborReader {
    private offset = 0

    constructor(private readonly data: Buffer) {}

    read(): unknown {
        const first = this.readByte()
        const major = first >> 5
        const additional = first & 0x1f
        const length = this.readLength(additional)
        if (major === 0) return length
        if (major === 1) return -1 - length
        if (major === 2) return this.readBytes(length)
        if (major === 3) return this.readBytes(length).toString('utf8')
        if (major === 4) return Array.from({ length }, () => this.read())
        if (major === 5) {
            const map = new Map<unknown, unknown>()
            for (let index = 0; index < length; index++) {
                map.set(this.read(), this.read())
            }
            return map
        }
        if (major === 6) return this.read()
        if (major === 7) {
            if (additional === 20) return false
            if (additional === 21) return true
            if (additional === 22) return null
        }
        throw new Error('Unsupported CBOR value in passkey payload.')
    }

    private readByte() {
        if (this.offset >= this.data.length) {
            throw new Error('Unexpected end of CBOR payload.')
        }
        return this.data[this.offset++]
    }

    private readLength(additional: number) {
        if (additional < 24) return additional
        if (additional === 24) return this.readByte()
        if (additional === 25) {
            const value = this.data.readUInt16BE(this.offset)
            this.offset += 2
            return value
        }
        if (additional === 26) {
            const value = this.data.readUInt32BE(this.offset)
            this.offset += 4
            return value
        }
        throw new Error('Unsupported CBOR length in passkey payload.')
    }

    private readBytes(length: number) {
        const value = this.data.subarray(this.offset, this.offset + length)
        this.offset += length
        if (value.length !== length) {
            throw new Error('Unexpected end of CBOR byte string.')
        }
        return value
    }
}
