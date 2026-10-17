import { afterEach, expect, test } from 'bun:test'
import {
    decodeUserHandle,
    newPasskeyChallenge,
    passkeyConfig,
    publicKeyCredentialDescriptor,
    userHandleFor,
    verifyAssertionCredential,
    verifyRegistrationCredential,
} from '../src/utils/auth/passkeys.ts'
import { readCbor } from '../src/utils/auth/passkeyCbor.ts'

const envKeys = [
    'PASSKEY_ORIGIN',
    'WEBAUTHN_ORIGIN',
    'NEXT_PUBLIC_APP_URL',
    'PASSKEY_RP_ID',
    'WEBAUTHN_RP_ID',
    'PASSKEY_RP_NAME',
] as const
const previousEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]))

afterEach(() => {
    for (const key of envKeys) {
        const value = previousEnv[key]
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
    }
})

test('passkey configuration keeps explicit values ahead of origin-derived defaults', () => {
    process.env.PASSKEY_ORIGIN = ' https://login.example.test/path '
    process.env.WEBAUTHN_ORIGIN = 'https://fallback.example.test'
    process.env.PASSKEY_RP_ID = ' credentials.example.test '
    process.env.WEBAUTHN_RP_ID = 'fallback.example.test'
    process.env.PASSKEY_RP_NAME = ' Example Login '

    expect(passkeyConfig()).toEqual({
        origin: 'https://login.example.test/path',
        rpId: 'credentials.example.test',
        rpName: 'Example Login',
    })
})

test('passkey challenge and user handle helpers keep their base64url contract', () => {
    const challenge = newPasskeyChallenge()
    const handle = userHandleFor('user@example.test')

    expect(Buffer.from(challenge, 'base64url')).toHaveLength(32)
    expect(challenge).not.toContain('=')
    expect(decodeUserHandle(handle)).toBe('user@example.test')
    expect(decodeUserHandle('')).toBeNull()
})

test('credential descriptors retain the accepted authenticator transports', () => {
    expect(publicKeyCredentialDescriptor('credential-id')).toEqual({
        type: 'public-key',
        id: 'credential-id',
        transports: ['internal', 'hybrid', 'usb', 'nfc', 'ble'],
    })
})

test('CBOR reader decodes maps, byte strings, and negative integer keys', () => {
    const decoded = readCbor(Buffer.from('a203260241ff', 'hex')) as Map<unknown, unknown>

    expect(decoded.get(3)).toBe(-7)
    expect(decoded.get(2)).toEqual(Buffer.from([0xff]))
})

test('credential verifiers reject a mismatched challenge before accepting payload data', () => {
    const clientDataJSON = Buffer.from(JSON.stringify({
        type: 'webauthn.get',
        challenge: 'unexpected',
        origin: 'https://hanasand.com',
    })).toString('base64url')
    const assertion = {
        credential: { response: { authenticatorData: Buffer.alloc(37).toString('base64url'), clientDataJSON, signature: 'AQ' } },
        challenge: 'expected',
        config: { rpId: 'hanasand.com', rpName: 'Hanasand', origin: 'https://hanasand.com' },
        publicKeyCose: 'AQ',
        previousSignCount: 0,
    }
    expect(() => verifyAssertionCredential(assertion)).toThrow('Passkey challenge did not match.')

    expect(() => verifyRegistrationCredential({
        credential: {
            response: {
                clientDataJSON: Buffer.from(JSON.stringify({
                    type: 'webauthn.create',
                    challenge: 'unexpected',
                    origin: 'https://hanasand.com',
                })).toString('base64url'),
                attestationObject: 'AQ',
            },
        },
        challenge: 'expected',
        config: assertion.config,
    })).toThrow('Passkey challenge did not match.')
})
