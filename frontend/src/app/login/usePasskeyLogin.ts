import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { decodePasskeyRequestOptions, passkeyCredentialToJSON } from '@/utils/auth/passkeys'
import { postAuthJson } from './postAuthJson'

type Props = {
    usernameRef: RefObject<HTMLInputElement | null>
    setBusy(value: boolean): void
    setError: Dispatch<SetStateAction<string | boolean | null>>
    redirectPath: string
    router: AppRouterInstance
}

export function usePasskeyLogin({ usernameRef, setBusy, setError, redirectPath, router }: Props) {
    async function handlePasskeyLogin() {
        if (!window.PublicKeyCredential || !navigator.credentials) {
            return setError('This browser does not support passkeys.')
        }

        setBusy(true)
        setError(null)
        try {
            const optionsUrl = new URL('/api/auth/passkeys/authenticate/options', window.location.origin)
            const username = usernameRef.current?.value.trim()
            if (username) optionsUrl.searchParams.set('username', username)
            const optionsResponse = await fetch(optionsUrl, { cache: 'no-store' })
            const options = await optionsResponse.json().catch(() => null)
            if (!optionsResponse.ok || !options?.challengeId || !options?.publicKey) {
                return setError(options?.error || 'No passkey challenge is available.')
            }

            const credential = await navigator.credentials.get({
                publicKey: decodePasskeyRequestOptions(options.publicKey),
            }) as PublicKeyCredential | null
            if (!credential) return setError('No passkey was selected.')

            const verifyResponse = await postAuthJson('/api/auth/passkeys/authenticate/verify', {
                challengeId: options.challengeId,
                credential: passkeyCredentialToJSON(credential),
            })
            const data = await verifyResponse.json().catch(() => null)
            if (!verifyResponse.ok) return setError(data?.error || 'Passkey login failed.')
            router.push(redirectPath)
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Passkey login failed.')
        } finally {
            setBusy(false)
        }
    }

    return handlePasskeyLogin
}
