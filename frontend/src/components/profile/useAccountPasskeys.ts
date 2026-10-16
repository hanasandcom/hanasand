import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { decodePasskeyCreationOptions, passkeyCredentialToJSON } from '@/utils/auth/passkeys'

export type PasskeyRow = {
    credentialId: string
    label: string
    algorithm: string
    createdAt: string
    lastUsedAt: string | null
}

type Props = {
    isSelf: boolean
    busy: boolean
    setBusy: Dispatch<SetStateAction<boolean>>
    setMessage: Dispatch<SetStateAction<string>>
}

export function useAccountPasskeys({ isSelf, busy, setBusy, setMessage }: Props) {
    const [passkeys, setPasskeys] = useState<PasskeyRow[]>([])
    const [editingPasskeyId, setEditingPasskeyId] = useState('')
    const [passkeyLabel, setPasskeyLabel] = useState('')

    const refreshPasskeys = useCallback(async () => {
        const response = await fetch('/api/auth/passkeys', { cache: 'no-store' }).catch(() => null)
        if (!response) return
        const data = await response.json().catch(() => null)
        if (response.ok && Array.isArray(data?.passkeys)) {
            setPasskeys(data.passkeys)
        }
    }, [])

    useEffect(() => {
        if (isSelf) void refreshPasskeys()
    }, [isSelf, refreshPasskeys])

    async function addPasskey() {
        if (!window.PublicKeyCredential || !navigator.credentials) {
            setMessage('This browser does not support passkeys.')
            return
        }
        if (busy) return

        setBusy(true)
        setMessage('')
        try {
            const optionsResponse = await fetch('/api/auth/passkeys/register/options', { cache: 'no-store' })
            const options = await optionsResponse.json().catch(() => null)
            if (!optionsResponse.ok || !options?.challengeId || !options?.publicKey) {
                setMessage(options?.error || 'Unable to start passkey enrollment.')
                return
            }

            const credential = await navigator.credentials.create({
                publicKey: decodePasskeyCreationOptions(options.publicKey),
            }) as PublicKeyCredential | null
            if (!credential) {
                setMessage('No passkey was created.')
                return
            }

            const verifyResponse = await fetch('/api/auth/passkeys/register/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    challengeId: options.challengeId,
                    credential: passkeyCredentialToJSON(credential),
                    label: defaultPasskeyLabel(),
                }),
            })
            const data = await verifyResponse.json().catch(() => null)
            if (!verifyResponse.ok) {
                setMessage(data?.error || 'Unable to save passkey.')
                return
            }

            setMessage('Passkey added. You can use it on the login page.')
            await refreshPasskeys()
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to add passkey.')
        } finally {
            setBusy(false)
        }
    }

    async function removePasskey(credentialId: string) {
        if (busy) return
        setBusy(true)
        setMessage('')
        try {
            const response = await fetch(`/api/auth/passkeys/${encodeURIComponent(credentialId)}`, {
                method: 'DELETE',
            })
            const data = await response.json().catch(() => null)
            if (!response.ok) {
                setMessage(data?.error || 'Unable to remove passkey.')
                return
            }
            setPasskeys(current => current.filter(passkey => passkey.credentialId !== credentialId))
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to remove passkey.')
        } finally {
            setBusy(false)
        }
    }

    async function renamePasskey(credentialId: string) {
        const label = passkeyLabel.trim().replace(/\s+/g, ' ')
        if (busy || !label) return
        setBusy(true)
        setMessage('')
        try {
            const response = await fetch(`/api/auth/passkeys/${encodeURIComponent(credentialId)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label }),
            })
            const data = await response.json().catch(() => null)
            if (!response.ok) {
                setMessage(data?.error || 'Unable to rename passkey.')
                return
            }
            setPasskeys(current => current.map(passkey => passkey.credentialId === credentialId
                ? { ...passkey, label: data?.label || label }
                : passkey))
            setEditingPasskeyId('')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to rename passkey.')
        } finally {
            setBusy(false)
        }
    }

    return {
        passkeys,
        editingPasskeyId,
        passkeyLabel,
        setEditingPasskeyId,
        setPasskeyLabel,
        addPasskey,
        removePasskey,
        renamePasskey,
    }
}

function defaultPasskeyLabel() {
    const userAgent = navigator.userAgent
    const platform = navigator.platform
    if (/iPhone/i.test(userAgent)) return 'Passkey iPhone'
    if (/iPad/i.test(userAgent) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'Passkey iPad'
    if (/Mac/i.test(platform)) return 'Passkey Mac'
    if (/Win/i.test(platform)) return 'Passkey Windows'
    if (/Android/i.test(userAgent)) return 'Passkey Android'
    if (/Linux/i.test(platform)) return 'Passkey Linux'
    return 'Passkey'
}
