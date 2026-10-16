'use client'

export default function ImpersonationReasonPrompt({
    userId,
    userName,
    reason,
    reasonError,
    pending,
    onReasonChange,
    onCancel,
    onSubmit,
}: {
    userId: string
    userName: string
    reason: string
    reasonError: string
    pending: boolean
    onReasonChange: (value: string) => void
    onCancel: (event: React.MouseEvent<HTMLButtonElement>) => void
    onSubmit: (event: React.SyntheticEvent<HTMLFormElement>) => void
}) {
    const reasonLength = reason.trim().replace(/\s+/g, ' ').length

    return (
        <form
            aria-label={`Impersonation reason for ${userId}`}
            className='absolute right-0 top-11 z-[100] grid w-80 max-w-[calc(100vw-2rem)] gap-2 rounded-lg border border-ui-primary/30 bg-ui-panel p-3 text-ui-text shadow-xl'
            onClick={event => event.stopPropagation()}
            onSubmit={onSubmit}
        >
            <label className='grid gap-1 text-xs font-semibold text-ui-text'>
                Reason for impersonating {userName}
                <textarea
                    className='min-h-20 resize-y rounded-md border border-ui-border bg-ui-raised px-3 py-2 text-sm font-medium text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary/60 focus:ring-2 focus:ring-ui-primary/15'
                    name='impersonationReason'
                    onChange={event => onReasonChange(event.target.value)}
                    placeholder='Describe the support case or audit reason'
                    value={reason}
                />
            </label>
            <div className='flex items-start justify-between gap-3 text-[0.68rem] leading-4 text-ui-muted'>
                <span>Required for audit. Starts a 30 minute profile and organization session.</span>
                <span>{reasonLength}/10</span>
            </div>
            {reasonError ? <p className='rounded-md border border-ui-danger/30 bg-ui-raised/10 px-2 py-1 text-xs font-semibold text-ui-text'>{reasonError}</p> : null}
            <div className='flex justify-end gap-2'>
                <button
                    className='h-8 rounded-md border border-ui-border px-3 text-xs font-bold text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'
                    disabled={pending}
                    onClick={onCancel}
                    type='button'
                >
                    Cancel
                </button>
                <button
                    className='h-8 rounded-md bg-ui-primary px-3 text-xs font-bold text-ui-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55'
                    disabled={pending}
                    type='submit'
                >
                    {pending ? 'Starting...' : 'Start session'}
                </button>
            </div>
        </form>
    )
}
