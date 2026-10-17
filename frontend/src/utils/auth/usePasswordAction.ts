import config from '@/config'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { useEffect, useState } from 'react'

type PasswordActionResponse = { error?: string } | null

export default function usePasswordAction(fallbackError: string) {
    const [token, setToken] = useState('')
    const [tokenLoaded, setTokenLoaded] = useState(false)
    const [busy, setBusy] = useState(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()

    useEffect(() => {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        setToken(params.get('token') || '')
        window.history.replaceState(null, '', window.location.pathname)
        setTokenLoaded(true)
    }, [])

    async function submit<TResponse extends PasswordActionResponse>(path: string, onSuccess: (data: TResponse) => void, blocked = false) {
        if (!token || busy || blocked) return
        setBusy(true)
        setError(null)
        try {
            const response = await fetch(`${config.url.api}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            })
            const data = await response.json().catch(() => null) as PasswordActionResponse
            if (!response.ok) return setError(data?.error || fallbackError)
            onSuccess(data as TResponse)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : fallbackError)
        } finally {
            setBusy(false)
        }
    }

    return { token, tokenLoaded, busy, error, submit }
}
