import { useState } from 'react'
import type { RowMessage } from '../types/activity'

export function useClipboardStatus() {
    const [status, setStatus] = useState<RowMessage | undefined>()

    async function copy(value: string, success: string, failure = 'Copy failed.') {
        try {
            await navigator.clipboard.writeText(value)
            setStatus({ ok: true, text: success })
        } catch {
            setStatus({ ok: false, text: failure })
        }
    }

    return { status, copy }
}
