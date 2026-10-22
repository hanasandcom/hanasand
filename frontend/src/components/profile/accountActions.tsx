'use client'

import SocialSignIn from '@/components/login/socialSignIn'
import { DashboardPanel } from 'hanasand/dashboard'
import { removeCookies } from 'hanasand/cookies'
import { Fingerprint, LogOut, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AccountPasskeyList } from './AccountPasskeyList'
import { useAccountPasskeys } from './useAccountPasskeys'

type Props = {
    isSelf: boolean
}

export default function AccountActions({ isSelf }: Props) {
    const router = useRouter()
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')
    const passkeys = useAccountPasskeys({ isSelf, busy, setBusy, setMessage })

    function clearAndGoLogin() {
        removeCookies('access_token', 'id', 'name', 'avatar', 'roles')
        router.push('/login')
    }

    async function deleteAccount() {
        if (busy) return
        setBusy(true)
        setMessage('')
        try {
            const response = await fetch('/api/backend/user/self', { method: 'DELETE' })
            const data = await response.json().catch(() => null)
            if (!response.ok) {
                setMessage(data?.error || 'Unable to schedule deletion.')
                return
            }
            clearAndGoLogin()
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to schedule deletion.')
        } finally {
            setBusy(false)
        }
    }

    if (!isSelf) return null

    return (
        <DashboardPanel className='p-4'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                    <h2 className='text-base font-semibold text-ui-text'>Account</h2>
                </div>
                <div className='flex flex-wrap gap-2'>
                    <button
                        onClick={() => void passkeys.addPasskey()}
                        disabled={busy}
                        className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text hover:bg-ui-raised disabled:opacity-60'
                    >
                        <Fingerprint className='h-4 w-4' />
                        Add passkey
                    </button>
                    <button
                        onClick={clearAndGoLogin}
                        className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text hover:bg-ui-raised'
                    >
                        <LogOut className='h-4 w-4' />
                        Log out
                    </button>
                    <button
                        onClick={() => setConfirmDelete(true)}
                        className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-danger/40 bg-ui-raised/10 px-3 text-sm font-semibold text-ui-text hover:bg-ui-raised/15'
                    >
                        <Trash2 className='h-4 w-4' />
                        Delete account
                    </button>
                </div>
            </div>
            <SocialSignIn link />
            {message && <p className='mt-3 text-sm text-ui-text'>{message}</p>}
            <AccountPasskeyList
                passkeys={passkeys.passkeys}
                editingPasskeyId={passkeys.editingPasskeyId}
                passkeyLabel={passkeys.passkeyLabel}
                busy={busy}
                onLabelChange={passkeys.setPasskeyLabel}
                onBeginRename={passkey => {
                    passkeys.setEditingPasskeyId(passkey.credentialId)
                    passkeys.setPasskeyLabel(passkey.label || 'Passkey')
                }}
                onCancelRename={() => passkeys.setEditingPasskeyId('')}
                onRename={credentialId => void passkeys.renamePasskey(credentialId)}
                onRemove={credentialId => void passkeys.removePasskey(credentialId)}
            />

            {confirmDelete && (
                <div className='fixed inset-0 z-50 grid place-items-center bg-ui-canvas/45 px-4 backdrop-blur-sm'>
                    <div className='grid w-full max-w-sm gap-4 rounded-xl border border-ui-border bg-ui-panel p-4 shadow-2xl shadow-ui-canvas/40'>
                        <div>
                            <h3 className='text-lg font-semibold text-ui-text'>Delete account?</h3>
                            <p className='mt-2 text-sm leading-6 text-ui-muted'>
                                Your account will be logged out everywhere and scheduled for permanent deletion after 30 days.
                            </p>
                        </div>
                        <div className='flex justify-end gap-2'>
                            <button
                                onClick={() => setConfirmDelete(false)}
                                className='h-9 rounded-lg px-3 text-sm font-semibold text-ui-muted hover:bg-ui-raised'
                            >
                                Cancel
                            </button>
                            <button
                                disabled={busy}
                                onClick={() => void deleteAccount()}
                                className='h-9 rounded-lg bg-ui-raised px-4 text-sm font-bold text-ui-canvas hover:bg-ui-raised disabled:opacity-60'
                            >
                                {busy ? 'Scheduling' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardPanel>
    )
}
