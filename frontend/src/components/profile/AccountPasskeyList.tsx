import { Check, Pencil, X } from 'lucide-react'
import type { PasskeyRow } from './useAccountPasskeys'

type Props = {
    passkeys: PasskeyRow[]
    editingPasskeyId: string
    passkeyLabel: string
    busy: boolean
    onLabelChange: (value: string) => void
    onBeginRename: (passkey: PasskeyRow) => void
    onCancelRename: () => void
    onRename: (credentialId: string) => void
    onRemove: (credentialId: string) => void
}

export function AccountPasskeyList({
    passkeys,
    editingPasskeyId,
    passkeyLabel,
    busy,
    onLabelChange,
    onBeginRename,
    onCancelRename,
    onRename,
    onRemove,
}: Props) {
    return (
        <>
            <h3 className='mb-2 mt-4 text-sm font-semibold text-ui-text'>Passkeys</h3>
            <div className='grid gap-2'>
                {passkeys.map(passkey => (
                    <div
                        key={passkey.credentialId}
                        className='flex min-w-0 flex-col gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 sm:flex-row sm:items-center sm:justify-between'
                    >
                        <div className='min-w-0 flex-1'>
                            {editingPasskeyId === passkey.credentialId ? (
                                <form
                                    className='flex w-full min-w-0 max-w-full gap-2'
                                    onSubmit={event => {
                                        event.preventDefault()
                                        onRename(passkey.credentialId)
                                    }}
                                >
                                    <input
                                        value={passkeyLabel}
                                        onChange={event => onLabelChange(event.target.value)}
                                        maxLength={80}
                                        className='h-9 min-w-0 flex-1 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                                        aria-label='Passkey name'
                                    />
                                    <button
                                        type='submit'
                                        disabled={busy || !passkeyLabel.trim()}
                                        className='grid h-9 w-9 place-items-center rounded-lg border border-ui-border bg-ui-panel text-ui-success disabled:opacity-60'
                                        aria-label='Save passkey name'
                                    >
                                        <Check className='h-4 w-4' />
                                    </button>
                                    <button
                                        type='button'
                                        disabled={busy}
                                        onClick={onCancelRename}
                                        className='grid h-9 w-9 place-items-center rounded-lg border border-ui-border bg-ui-panel text-ui-muted disabled:opacity-60'
                                        aria-label='Cancel rename'
                                    >
                                        <X className='h-4 w-4' />
                                    </button>
                                </form>
                            ) : (
                                <p className='text-sm font-semibold text-ui-text'>
                                    {passkey.label || 'Passkey'}
                                </p>
                            )}
                            <p className='mt-1 text-xs text-ui-muted'>
                                {passkey.algorithm} · {passkey.lastUsedAt
                                    ? `Last used ${formatDate(passkey.lastUsedAt)}`
                                    : `Added ${formatDate(passkey.createdAt)}`}
                            </p>
                        </div>
                        <div className='flex shrink-0 flex-wrap gap-2'>
                            <button
                                disabled={busy}
                                onClick={() => onBeginRename(passkey)}
                                className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text hover:bg-ui-canvas disabled:opacity-60'
                            >
                                <Pencil className='h-3.5 w-3.5' />
                                Rename
                            </button>
                            <button
                                disabled={busy}
                                onClick={() => onRemove(passkey.credentialId)}
                                className='h-8 rounded-lg border border-ui-danger/40 bg-ui-raised/10 px-3 text-xs font-semibold text-ui-text hover:bg-ui-raised/15 disabled:opacity-60'
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                ))}
                {!passkeys.length && (
                    <div className='rounded-lg border border-dashed border-ui-border bg-ui-raised p-3 text-sm text-ui-muted'>
                        No passkeys enrolled.
                    </div>
                )}
            </div>
        </>
    )
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
