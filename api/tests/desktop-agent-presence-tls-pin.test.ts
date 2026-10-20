import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const queries: Array<{ sql: string, params: unknown[] }> = []
const rows = new Map<string, Record<string, unknown>>()
let authorized = true
const ownerId = 'desktop-pin-owner'

const query = async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params })

    if (sql.includes('INSERT INTO desktop_agent_presence')) {
        const [owner, device, name, endpoints, certificatePin] = params as [string, string, string, string[], string | null]
        const row = {
            owner_id: owner,
            device_id: device,
            device_name: name,
            endpoints,
            tls_certificate_sha256: certificatePin,
            updated_at: new Date('2026-10-20T00:00:00.000Z'),
            expires_at: new Date('2026-10-20T00:05:00.000Z'),
        }
        rows.set(`${owner}:${device}`, row)
        return { rows: [row] }
    }

    if (sql.includes('FROM desktop_agent_presence')) {
        return { rows: [...rows.values()].filter(row => row.owner_id === params[0]) }
    }

    throw new Error(`Unexpected database query: ${sql}`)
}

mock.module('#db', () => ({ default: query }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({
    default: async () => authorized ? { valid: true, id: ownerId } : { valid: false, id: null },
}))

const { getDesktopAgentPresence, postDesktopAgentPresence } = await import('../src/handlers/desktopAgent/presence.ts')
const app = Fastify()
app.get('/desktop-agent/presence', getDesktopAgentPresence)
app.post('/desktop-agent/presence', postDesktopAgentPresence)
afterAll(async () => { await app.close() })

beforeEach(() => {
    queries.length = 0
    rows.clear()
    authorized = true
})

const presence = (tlsCertificateSha256?: string, endpoint = 'https://192.168.1.40:45731') => app.inject({
    method: 'POST',
    url: '/desktop-agent/presence',
    payload: {
        deviceId: 'mac-1',
        deviceName: 'Test Mac',
        endpoints: [endpoint],
        ...(tlsCertificateSha256 === undefined ? {} : { tlsCertificateSha256 }),
    },
})

test('presence accepts, persists, and returns the leaf DER SHA-256 pin', async () => {
    const pin = 'a'.repeat(64)
    const posted = await presence(pin)
    expect(posted.statusCode).toBe(200)
    expect(posted.json().agent.tlsCertificateSha256).toBe(pin)

    const insert = queries.find(({ sql }) => sql.includes('INSERT INTO desktop_agent_presence'))
    expect(insert?.sql).toContain('tls_certificate_sha256')
    expect(insert?.params).toEqual([ownerId, 'mac-1', 'Test Mac', ['https://192.168.1.40:45731'], pin])

    const fetched = await app.inject('/desktop-agent/presence')
    expect(fetched.statusCode).toBe(200)
    expect(fetched.json().agents).toHaveLength(1)
    expect(fetched.json().agents[0].tlsCertificateSha256).toBe(pin)
    expect(queries.find(({ sql }) => sql.includes('FROM desktop_agent_presence'))?.sql).toContain('tls_certificate_sha256')
})

test('presence rejects malformed pins before writing', async () => {
    for (const malformed of ['A'.repeat(64), 'a'.repeat(63), 'g'.repeat(64)]) {
        const response = await presence(malformed)
        expect(response.statusCode).toBe(400)
    }
    expect(queries).toHaveLength(0)
})

test('presence accepts private HTTPS endpoints and rejects public HTTPS endpoints', async () => {
    const privateEndpoint = await presence('d'.repeat(64), 'https://192.168.1.40:45731')
    expect(privateEndpoint.statusCode).toBe(200)
    expect(privateEndpoint.json().agent.endpoints).toEqual(['https://192.168.1.40:45731'])

    queries.length = 0
    rows.clear()

    const publicEndpoint = await presence('e'.repeat(64), 'https://agent.example.com:45731')
    expect(publicEndpoint.statusCode).toBe(400)
    expect(publicEndpoint.json().error).toContain('at least one LAN endpoint')
    expect(queries).toHaveLength(0)
})

test('legacy presence publishers clear an existing pin when the field is omitted', async () => {
    const pin = 'b'.repeat(64)
    expect((await presence(pin)).json().agent.tlsCertificateSha256).toBe(pin)

    const legacyUpdate = await presence()
    expect(legacyUpdate.statusCode).toBe(200)
    expect(legacyUpdate.json().agent.tlsCertificateSha256).toBeNull()
    expect(queries.at(-1)?.params.at(-1)).toBeNull()

    const fetched = await app.inject('/desktop-agent/presence')
    expect(fetched.json().agents[0].tlsCertificateSha256).toBeNull()
})

test('presence GET and POST require authentication and do not query the database', async () => {
    authorized = false

    const get = await app.inject('/desktop-agent/presence')
    const post = await presence('c'.repeat(64))

    expect(get.statusCode).toBe(401)
    expect(get.json()).toEqual({ error: 'Unauthorized.' })
    expect(post.statusCode).toBe(401)
    expect(post.json()).toEqual({ error: 'Unauthorized.' })
    expect(queries).toHaveLength(0)
})
