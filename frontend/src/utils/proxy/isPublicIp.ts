import { isIP } from 'node:net'

const blockedV4 = [
    '0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8',
    '169.254.0.0/16', '172.16.0.0/12', '192.0.0.0/24', '192.0.2.0/24',
    '192.88.99.0/24', '192.168.0.0/16', '198.18.0.0/15', '198.51.100.0/24',
    '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4',
]

export default function isPublicIp(value: string) {
    const family = isIP(value)
    if (family === 4) return isPublicIpv4(value)
    if (family === 6) return isPublicIpv6(value)
    return false
}

function isPublicIpv4(value: string) {
    const octets = value.split('.').map(Number)
    if (octets.length !== 4 || octets.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false
    return !blockedV4.some(range => matchesIpv4Range(octets, range))
}

function matchesIpv4Range(octets: number[], range: string) {
    const [network, prefix] = range.split('/')
    const bits = Number(prefix)
    const networkOctets = network.split('.').map(Number)
    const count = Math.ceil(bits / 8)
    for (let i = 0; i < count; i++) {
        const remaining = bits - i * 8
        const mask = remaining >= 8 ? 255 : 256 - 2 ** (8 - remaining)
        if ((octets[i] & mask) !== (networkOctets[i] & mask)) return false
    }
    return true
}

function isPublicIpv6(value: string) {
    const groups = ipv6Groups(value)
    if (!groups || groups[0] < 0x2000 || groups[0] > 0x3fff) return false
    if (groups[0] === 0x2001 && (groups[1] <= 0x01ff || groups[1] === 0x0db8
        || (groups[1] & 0xfff0) === 0x0010 || (groups[1] & 0xfff0) === 0x0020)) return false
    if (groups[0] === 0x2002 || (groups[0] === 0x3fff && groups[1] < 0x1000)) return false
    return true
}

function ipv6Groups(value: string) {
    const source = value.toLowerCase()
    const parts = source.split(':')
    const v4 = parts.at(-1)
    if (v4?.includes('.')) {
        const octets = v4.split('.').map(Number)
        if (octets.length !== 4 || octets.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return null
        parts.splice(-1, 1, ((octets[0] << 8) | octets[1]).toString(16), ((octets[2] << 8) | octets[3]).toString(16))
    }
    const marker = parts.indexOf('')
    let groups = parts.filter(Boolean).map(group => Number.parseInt(group, 16))
    if (groups.some(group => !Number.isInteger(group) || group < 0 || group > 0xffff)) return null
    if (marker >= 0) {
        const gap = 8 - groups.length
        if (gap < 1) return null
        groups = [...parts.slice(0, marker).filter(Boolean).map(group => Number.parseInt(group, 16)),
            ...Array(gap).fill(0), ...parts.slice(marker + 1).filter(Boolean).map(group => Number.parseInt(group, 16))]
    }
    return groups.length === 8 ? groups : null
}
