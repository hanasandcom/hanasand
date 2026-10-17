import assert from 'node:assert/strict'
import { mock } from 'bun:test'

type Handler = (...args: any[]) => Promise<any>

export async function smokePasskeyManagementHandlers() {
    const rows = [
        {
            credential_id: 'cred-es256',
            label: 'Passkey (platform)',
            alg: -7,
            aaguid: '00000000-0000-0000-0000-000000000000',
            sign_count: 4,
            created_at: '2026-07-01T10:00:00.000Z',
            last_used_at: '2026-07-02T10:00:00.000Z',
            user_id: 'passkey-user',
        },
        {
            credential_id: 'cred-rs256',
            label: 'Security key',
            alg: -257,
            aaguid: null,
            sign_count: 1,
            created_at: '2026-07-01T09:00:00.000Z',
            last_used_at: null,
            user_id: 'passkey-user',
        },
    ]

    mock.module('#db', () => ({
        default: async (query: string, params: unknown[] = []) => {
            const compact = query.replace(/\s+/g, ' ').trim()
            if (compact.startsWith('SELECT credential_id, label, alg')) {
                assert.equal(params[0], 'passkey-user')
                return { rows: rows.filter(row => row.user_id === params[0]) }
            }
            if (compact.startsWith('DELETE FROM user_passkeys')) {
                const [credentialId, userId] = params
                const index = rows.findIndex(row => row.credential_id === credentialId && row.user_id === userId)
                if (index === -1) return { rows: [] }
                const [deleted] = rows.splice(index, 1)
                return { rows: [{ credential_id: deleted.credential_id }] }
            }
            if (compact.startsWith('UPDATE user_passkeys SET label')) {
                const [credentialId, userId, label] = params
                const row = rows.find(entry => entry.credential_id === credentialId && entry.user_id === userId)
                if (!row) return { rows: [] }
                row.label = String(label)
                return { rows: [{ credential_id: row.credential_id, label: row.label }] }
            }
            throw new Error(`Unexpected passkey smoke query: ${compact}`)
        },
    }))
    mock.module('#utils/auth/tokenWrapper.ts', () => ({
        default: async () => ({ valid: true, id: 'passkey-user' }),
    }))

    const { getPasskeys, deletePasskey, patchPasskey } = await import('../src/handlers/auth/passkeys.ts')
    await verifyPasskeyList(getPasskeys)
    await verifyPasskeyLabelUpdates(patchPasskey)
    await verifyPasskeyDeletion(getPasskeys, deletePasskey)
}

async function verifyPasskeyList(getPasskeys: Handler) {
    const listReply = makeReply()
    await getPasskeys({} as any, listReply as any)
    assert.equal(listReply.statusCode, 200)
    assert.deepEqual(listReply.payload.passkeys.map((item: any) => ({
        credentialId: item.credentialId,
        algorithm: item.algorithm,
        signCount: item.signCount,
        lastUsedAt: item.lastUsedAt,
    })), [
        { credentialId: 'cred-es256', algorithm: 'ES256', signCount: 4, lastUsedAt: '2026-07-02T10:00:00.000Z' },
        { credentialId: 'cred-rs256', algorithm: 'RS256', signCount: 1, lastUsedAt: null },
    ])
}

async function verifyPasskeyLabelUpdates(patchPasskey: Handler) {
    const patchReply = makeReply()
    await patchPasskey({ params: { credentialId: 'cred-es256' }, body: { label: ' Eirik MBP  ' } } as any, patchReply as any)
    assert.equal(patchReply.statusCode, 200)
    assert.deepEqual(patchReply.payload, { ok: true, credentialId: 'cred-es256', label: 'Eirik MBP' })

    const blankPatchReply = makeReply()
    await patchPasskey({ params: { credentialId: 'cred-es256' }, body: { label: ' ' } } as any, blankPatchReply as any)
    assert.equal(blankPatchReply.statusCode, 400)
    assert.equal(blankPatchReply.payload.error, 'Passkey name is required.')
}

async function verifyPasskeyDeletion(getPasskeys: Handler, deletePasskey: Handler) {
    const deleteReply = makeReply()
    await deletePasskey({ params: { credentialId: 'cred-es256' } } as any, deleteReply as any)
    assert.equal(deleteReply.statusCode, 200)
    assert.deepEqual(deleteReply.payload, { ok: true, credentialId: 'cred-es256' })

    const listAfterDeleteReply = makeReply()
    await getPasskeys({} as any, listAfterDeleteReply as any)
    assert.deepEqual(listAfterDeleteReply.payload.passkeys.map((item: any) => item.credentialId), ['cred-rs256'])

    const repeatDeleteReply = makeReply()
    await deletePasskey({ params: { credentialId: 'cred-es256' } } as any, repeatDeleteReply as any)
    assert.equal(repeatDeleteReply.statusCode, 404)
    assert.equal(repeatDeleteReply.payload.error, 'Passkey not found.')
}

function makeReply() {
    return {
        statusCode: 200,
        payload: undefined as any,
        status(code: number) {
            this.statusCode = code
            return this
        },
        send(payload: unknown) {
            this.payload = payload
            return payload
        },
    }
}
