'use client'

import Link from 'next/link'
import { CheckCircle2, Cookie, KeyRound, RefreshCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { removeCookie, setCookie } from '@/utils/cookies/cookies'
import { ConsentButton, StatusRow, TokenList } from './CookieSettingsRows'
import {
    clearKeys,
    emptySnapshot,
    readSnapshot,
    type ConsentChoice,
    type StorageSnapshot,
} from './storageSnapshot'

const consentCookie = 'hanasand_cookie_consent'
const consentUpdatedCookie = 'hanasand_cookie_consent_updated_at'

export default function CookieSettingsClient() {
    const [snapshot, setSnapshot] = useState<StorageSnapshot>(() => emptySnapshot())
    const [message, setMessage] = useState('Settings loaded.')

    useEffect(() => {
        setSnapshot(readCurrentSnapshot())
    }, [])

    const consentLabel = useMemo(() => {
        if (snapshot.consent === 'optional') return 'Optional cookies allowed'
        if (snapshot.consent === 'essential') return 'Essential cookies only'
        return 'No preference saved'
    }, [snapshot.consent])

    function saveConsent(choice: Exclude<ConsentChoice, 'unset'>) {
        const updatedAt = new Date().toISOString()
        setCookie(consentCookie, choice, 365)
        setCookie(consentUpdatedCookie, updatedAt, 365)
        setSnapshot(readCurrentSnapshot())
        setMessage(choice === 'optional' ? 'Optional cookie consent saved.' : 'Essential-only preference saved.')
    }

    function resetConsent() {
        removeCookie(consentCookie)
        removeCookie(consentUpdatedCookie)
        setSnapshot(readCurrentSnapshot())
        setMessage('Cookie consent choice reset for this browser.')
    }

    function clearProductStorage() {
        const cleared = clearKeys(snapshot.localProductKeys, window.localStorage)
            + clearKeys(snapshot.sessionProductKeys, window.sessionStorage)
        setSnapshot(readCurrentSnapshot())
        setMessage(cleared ? `Cleared ${cleared} local product token${cleared === 1 ? '' : 's'}.` : 'No local product tokens were present.')
    }

    return (
        <main className='min-h-app-viewport bg-ui-canvas text-ui-text'>
            <section className='border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-5xl gap-4 px-4 py-14 md:px-8 md:py-18'>
                    <p className='text-sm font-semibold uppercase text-ui-primary'>Settings</p>
                    <h1 className='text-4xl font-semibold tracking-normal md:text-5xl'>Cookie settings</h1>
                    <p className='max-w-3xl text-lg leading-8 text-ui-muted'>
                        Keep the required account cookies, tune optional consent, and clear browser-local Hanasand tokens when this device needs a fresh start.
                    </p>
                </div>
            </section>

            <section className='mx-auto grid max-w-5xl gap-4 px-4 py-10 md:px-8'>
                <div className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <div className='flex items-center gap-3'>
                            <span className='grid h-10 w-10 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                                <Cookie className='h-5 w-5' />
                            </span>
                            <div>
                                <p className='text-sm font-semibold text-ui-text'>{consentLabel}</p>
                                <p className='text-sm text-ui-muted'>{snapshot.consentUpdatedAt ? `Updated ${formatDate(snapshot.consentUpdatedAt)}` : 'This browser has not saved a consent choice yet.'}</p>
                            </div>
                        </div>
                        <p className='rounded-full border border-ui-border bg-ui-raised px-3 py-1.5 text-xs font-semibold text-ui-muted'>{message}</p>
                    </div>
                </div>

                <div className='grid gap-4 lg:grid-cols-[1fr_0.8fr]'>
                    <section className='rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm'>
                        <div className='flex items-start justify-between gap-3'>
                            <div>
                                <h2 className='text-lg font-semibold'>Consent</h2>
                                <p className='mt-2 text-sm leading-7 text-ui-muted'>
                                    Required cookies keep login and protected routes working. Optional cookies are for product measurement and remembered notices when Hanasand enables them.
                                </p>
                            </div>
                            <ShieldCheck className='h-5 w-5 text-ui-success' />
                        </div>

                        <div className='mt-5 grid gap-2 sm:grid-cols-3'>
                            <ConsentButton active={snapshot.consent === 'optional'} onClick={() => saveConsent('optional')} icon={<CheckCircle2 className='h-4 w-4' />} title='Allow optional' detail='Fine for product measurement.' />
                            <ConsentButton active={snapshot.consent === 'essential'} onClick={() => saveConsent('essential')} icon={<ShieldCheck className='h-4 w-4' />} title='Essential only' detail='Keep it lean.' />
                            <ConsentButton active={snapshot.consent === 'unset'} onClick={resetConsent} icon={<RefreshCcw className='h-4 w-4' />} title='Reset choice' detail='Ask again later.' />
                        </div>
                    </section>

                    <section className='rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm'>
                        <div className='flex items-start justify-between gap-3'>
                            <div>
                                <h2 className='text-lg font-semibold'>Account tokens</h2>
                                <p className='mt-2 text-sm leading-7 text-ui-muted'>
                                    Sign-in cookies are required for the console. Values are never shown here.
                                </p>
                            </div>
                            <KeyRound className='h-5 w-5 text-ui-primary' />
                        </div>
                        <div className='mt-4 grid gap-2'>
                            <StatusRow label='Session token' present={snapshot.sessionToken} />
                            <StatusRow label='Support session token' present={snapshot.impersonationToken} />
                        </div>
                        <Link
                            href='/logout'
                            className='mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text shadow-sm transition hover:border-ui-primary'
                        >
                            <KeyRound className='h-4 w-4' />
                            Sign out to clear session
                        </Link>
                    </section>
                </div>

                <section className='rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm'>
                    <div className='flex flex-wrap items-start justify-between gap-3'>
                        <div>
                            <h2 className='text-lg font-semibold'>Browser-local product tokens</h2>
                            <p className='mt-2 max-w-3xl text-sm leading-7 text-ui-muted'>
                                These are local drafts and product state for share workspaces, DWM setup, recent uploads, load testing, TI cache, and AI workspace continuity. Clearing them does not change your account, username, or theme.
                            </p>
                        </div>
                        <button
                            type='button'
                            onClick={clearProductStorage}
                            className='inline-flex h-10 items-center gap-2 rounded-md border border-ui-danger bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:bg-ui-raised'
                        >
                            <Trash2 className='h-4 w-4' />
                            Clear local tokens
                        </button>
                    </div>

                    <div className='mt-4 grid gap-3 md:grid-cols-2'>
                        <TokenList title='Local storage' keys={snapshot.localProductKeys} />
                        <TokenList title='Session storage' keys={snapshot.sessionProductKeys} />
                    </div>
                </section>

                <section className='rounded-lg border border-ui-border bg-ui-panel p-5 text-sm leading-7 text-ui-muted shadow-sm'>
                    Browser controls can still delete every cookie and storage item for this site. Hanasand keeps username and visual theme controls in the account and header surfaces where users already expect them.
                </section>
            </section>
        </main>
    )
}

function readCurrentSnapshot(): StorageSnapshot {
    return readSnapshot({
        cookieString: document.cookie,
        localStorage: window.localStorage,
        sessionStorage: window.sessionStorage,
    })
}

function formatDate(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
}
