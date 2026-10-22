function encodeBase64Url(value: ArrayBuffer) {
    const bytes = new Uint8Array(value)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function decodeBase64Url(value: string) {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4))
    return Uint8Array.from(binary, character => character.charCodeAt(0))
}

export function serializeCredential(credential: PublicKeyCredential) {
    const response = credential.response as AuthenticatorAssertionResponse
    return {
        id: credential.id,
        rawId: encodeBase64Url(credential.rawId),
        type: credential.type,
        response: {
            clientDataJSON: encodeBase64Url(response.clientDataJSON),
            authenticatorData: encodeBase64Url(response.authenticatorData),
            signature: encodeBase64Url(response.signature),
            userHandle: response.userHandle ? encodeBase64Url(response.userHandle) : null,
        },
    }
}
