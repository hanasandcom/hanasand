import { createHash, createPublicKey, createVerify } from 'crypto'
import type { PasskeyConfig } from './passkeyConfig.ts'
import { mapGetBuffer, mapGetNumber, readCbor } from './passkeyCbor.ts'

export type ParsedRegistration = {
    credentialId: string
    publicKeyCose: string
    signCount: number
    alg: number
    aaguid: string
}

export type ParsedAssertion = {
    signCount: number
    userPresent: boolean
}

type ClientData = {
    type?: string
    challenge?: string
    origin?: string
}

type AuthData = {
    flags: number
    signCount: number
    credentialId?: Buffer
    publicKeyCose?: Buffer
    aaguid?: Buffer
}

export function verifyRegistrationCredential(input: {
    credential: Record<string, any>
    challenge: string
    config: PasskeyConfig
}): ParsedRegistration {
    const response = toRecord(input.credential.response)
    const clientDataJSON = fromBase64Url(text(response.clientDataJSON))
    const clientData = parseClientData(clientDataJSON)
    assertClientData(clientData, 'webauthn.create', input.challenge, input.config.origin)

    const attestationObject = readCbor(fromBase64Url(text(response.attestationObject))) as Map<unknown, unknown>
    const authDataBytes = mapGetBuffer(attestationObject, 'authData')
    const authData = parseAuthData(authDataBytes)
    if (!authData.credentialId || !authData.publicKeyCose || !authData.aaguid) {
        throw new Error('Passkey registration did not include attested credential data.')
    }
    assertRpIdHash(authDataBytes, input.config.rpId)
    assertUserPresent(authData.flags)

    const publicKey = readCbor(authData.publicKeyCose) as Map<unknown, unknown>
    const alg = mapGetNumber(publicKey, 3)
    if (![-7, -257].includes(alg)) {
        throw new Error(`Unsupported passkey public key algorithm ${alg}.`)
    }

    return {
        credentialId: authData.credentialId.toString('base64url'),
        publicKeyCose: authData.publicKeyCose.toString('base64url'),
        signCount: authData.signCount,
        alg,
        aaguid: authData.aaguid.toString('hex'),
    }
}

export function verifyAssertionCredential(input: {
    credential: Record<string, any>
    challenge: string
    config: PasskeyConfig
    publicKeyCose: string
    previousSignCount: number
}): ParsedAssertion {
    const response = toRecord(input.credential.response)
    const authenticatorData = fromBase64Url(text(response.authenticatorData))
    const clientDataJSON = fromBase64Url(text(response.clientDataJSON))
    const signature = fromBase64Url(text(response.signature))
    const clientData = parseClientData(clientDataJSON)
    assertClientData(clientData, 'webauthn.get', input.challenge, input.config.origin)
    assertRpIdHash(authenticatorData, input.config.rpId)

    const authData = parseAuthData(authenticatorData)
    assertUserPresent(authData.flags)
    const signed = Buffer.concat([
        authenticatorData,
        createHash('sha256').update(clientDataJSON).digest(),
    ])
    const publicKey = publicKeyFromCose(fromBase64Url(input.publicKeyCose))
    const verifier = createVerify('SHA256')
    verifier.update(signed)
    verifier.end()
    if (!verifier.verify(publicKey, signature)) {
        throw new Error('Passkey signature was invalid.')
    }
    if (authData.signCount > 0 && input.previousSignCount > 0 && authData.signCount <= input.previousSignCount) {
        throw new Error('Passkey sign counter did not advance.')
    }

    return {
        signCount: authData.signCount,
        userPresent: true,
    }
}

function publicKeyFromCose(publicKeyCose: Buffer) {
    const cose = readCbor(publicKeyCose) as Map<unknown, unknown>
    const alg = mapGetNumber(cose, 3)
    if (alg === -7) {
        const x = mapGetBuffer(cose, -2).toString('base64url')
        const y = mapGetBuffer(cose, -3).toString('base64url')
        return createPublicKey({ key: { kty: 'EC', crv: 'P-256', x, y }, format: 'jwk' })
    }
    if (alg === -257) {
        const n = mapGetBuffer(cose, -1).toString('base64url')
        const e = mapGetBuffer(cose, -2).toString('base64url')
        return createPublicKey({ key: { kty: 'RSA', n, e }, format: 'jwk' })
    }
    throw new Error(`Unsupported passkey public key algorithm ${alg}.`)
}

function parseAuthData(bytes: Buffer): AuthData {
    if (bytes.length < 37) {
        throw new Error('Passkey authenticator data was too short.')
    }
    const flags = bytes[32]
    const signCount = bytes.readUInt32BE(33)
    const result: AuthData = { flags, signCount }
    if ((flags & 0x40) === 0) {
        return result
    }
    let offset = 37
    result.aaguid = bytes.subarray(offset, offset + 16)
    offset += 16
    const credentialIdLength = bytes.readUInt16BE(offset)
    offset += 2
    result.credentialId = bytes.subarray(offset, offset + credentialIdLength)
    offset += credentialIdLength
    result.publicKeyCose = bytes.subarray(offset)
    return result
}

function assertRpIdHash(authenticatorData: Buffer, rpId: string) {
    const expected = createHash('sha256').update(rpId).digest()
    if (!authenticatorData.subarray(0, 32).equals(expected)) {
        throw new Error('Passkey RP ID hash did not match.')
    }
}

function assertUserPresent(flags: number) {
    if ((flags & 0x01) === 0) {
        throw new Error('Passkey user-present flag was not set.')
    }
}

function parseClientData(clientDataJSON: Buffer): ClientData {
    return JSON.parse(clientDataJSON.toString('utf8')) as ClientData
}

function assertClientData(clientData: ClientData, type: string, challenge: string, origin: string) {
    if (clientData.type !== type) {
        throw new Error('Passkey client data type did not match.')
    }
    if (clientData.challenge !== challenge) {
        throw new Error('Passkey challenge did not match.')
    }
    if (clientData.origin !== origin) {
        throw new Error('Passkey origin did not match.')
    }
}

function fromBase64Url(value: string) {
    if (!value) throw new Error('Passkey payload field was empty.')
    return Buffer.from(value, 'base64url')
}

function text(value: unknown) {
    return typeof value === 'string' ? value : ''
}

function toRecord(value: unknown) {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}
