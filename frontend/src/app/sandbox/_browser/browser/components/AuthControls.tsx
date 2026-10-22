'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ensureBrowserIdentitySession } from '../browserSession'
import { browserApiBase } from '../browserSetup'

export default function AuthControls() {
    const [id, setId] = useState('')
    const [canSignOut, setCanSignOut] = useState(false)
    const [busy, setBusy] = useState(false)
    const [checkVersion, setCheckVersion] = useState(0)
    const [sessionState, setSessionState] = useState<'checking' | 'guest' | 'signed-in' | 'error'>('checking')

    useEffect(() => {
        let active = true
        setSessionState('checking')
        ensureBrowserIdentitySession()
            .then(session => {
                if (!active) return
                const userId = typeof session.user?.id === 'string' ? session.user.id : ''
                setId(userId)
                setCanSignOut(session.canSignOut === true)
                setSessionState(userId ? 'signed-in' : 'guest')
            })
            .catch(() => {
                if (!active) return
                setId('')
                setCanSignOut(false)
                setSessionState('error')
            })
        return () => { active = false }
    }, [checkVersion])

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
        {sessionState === 'signed-in' && id ? <>
            <span className='max-w-36 truncate text-ui-muted' title={id}>{id}</span>
            {canSignOut ? <button type='button' onClick={() => void signOut()} disabled={busy} className='rounded border border-ui-border px-2 py-1 text-ui-text hover:bg-ui-raised disabled:opacity-50'>Sign out</button> : null}
        </> : sessionState === 'guest' ? <>
            <span className='text-ui-muted'>Guest session</span>
            <Link href='/login?path=%2Fsandbox' className='rounded bg-ui-primary px-2 py-1 font-medium text-ui-on-primary hover:opacity-85'>Sign in</Link>
        </> : sessionState === 'error' ? <>
            <span role='status' className='text-ui-muted'>Could not verify your session</span>
            <button type='button' onClick={() => setCheckVersion(value => value + 1)} className='rounded border border-ui-border px-2 py-1 text-ui-text hover:bg-ui-raised'>Retry</button>
        </> : <span role='status' className='text-ui-muted'>Checking session…</span>}
    </div>
}
