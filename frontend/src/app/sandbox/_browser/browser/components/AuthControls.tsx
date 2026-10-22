'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { browserApiBase } from '../browserSetup'

export default function AuthControls() {
    const [id, setId] = useState('')
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        const controller = new AbortController()
        fetch(`${browserApiBase}/browser/session`, { credentials: 'include', cache: 'no-store', signal: controller.signal })
            .then(async response => response.ok ? await response.json() as { user?: { id?: string } | null } : {})
            .then(session => setId(typeof session.user?.id === 'string' ? session.user.id : ''))
            .catch(() => undefined)
        return () => controller.abort()
    }, [])

    async function signOut() {
        setBusy(true)
        try {
            await fetch(`${browserApiBase}/browser/session/logout`, { method: 'POST', credentials: 'include', cache: 'no-store' })
        } finally {
            setId('')
            setBusy(false)
            window.location.assign('/sandbox')
        }
    }

    return <div className='fixed right-3 top-[4.75rem] z-40 flex items-center gap-2 rounded-md border border-ui-border bg-ui-panel/95 px-3 py-2 text-xs shadow-ui-panel sm:right-5'>
        {id ? <>
            <span className='max-w-36 truncate text-ui-muted' title={id}>{id}</span>
            <button type='button' onClick={() => void signOut()} disabled={busy} className='rounded border border-ui-border px-2 py-1 text-ui-text hover:bg-ui-raised disabled:opacity-50'>Sign out</button>
        </> : <>
            <span className='text-ui-muted'>Guest session</span>
            <Link href='/sandbox/login' className='rounded bg-ui-primary px-2 py-1 font-medium text-ui-on-primary hover:opacity-85'>Sign in</Link>
        </>}
    </div>
}
