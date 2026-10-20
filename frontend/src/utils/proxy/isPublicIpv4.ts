const blockedRanges = [
    '0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8',
    '169.254.0.0/16', '172.16.0.0/12', '192.0.0.0/24', '192.0.2.0/24',
    '192.88.99.0/24', '192.168.0.0/16', '198.18.0.0/15', '198.51.100.0/24',
    '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4',
]

export default function isPublicIpv4(value: string) {
    const octets = value.split('.').map(Number)
    if (octets.length !== 4 || octets.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false
    return !blockedRanges.some(range => {
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
    })
}
