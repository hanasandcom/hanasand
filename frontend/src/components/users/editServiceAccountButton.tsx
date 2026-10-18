'use client'

import { useId, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import IconButton from './iconButton'
import FormField from '@/components/forms/formField'

export default function EditServiceAccountButton({ name, description, onSave }: { name: string, description: string, onSave: (details: { name: string, description: string }) => Promise<void> }) {
    const descriptionId = useId()
    const dialog = useRef<HTMLDialogElement>(null)
    const input = useRef<HTMLInputElement>(null)
    const [draftName, setDraftName] = useState(name)
    const [draftDescription, setDraftDescription] = useState(description)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')

    return <>
        <IconButton label={`Edit ${name}`} onClick={() => { setDraftName(name); setDraftDescription(description); setError(''); dialog.current?.showModal(); input.current?.focus() }}><Pencil className='h-4 w-4' aria-hidden='true' /></IconButton>
        <dialog ref={dialog} aria-label={`Edit ${name}`} onCancel={event => { if (pending) event.preventDefault() }} className='m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-ui-border bg-ui-panel p-5 text-ui-text shadow-2xl backdrop:bg-ui-backdrop backdrop:backdrop-blur-sm'>
            <form className='grid gap-4' onSubmit={async event => {
                event.preventDefault()
                if (pending || !draftName.trim()) return
                setPending(true); setError('')
                try { await onSave({ name: draftName.trim(), description: draftDescription.trim() }); dialog.current?.close() }
                catch (error) { setError(error instanceof Error ? error.message : 'Unable to save service account.') }
                finally { setPending(false) }
            }}>
                <h2 className='text-lg font-semibold'>Edit service account</h2>
                <FormField label='Name' className='grid gap-1 text-sm'><input ref={input} value={draftName} onChange={event => setDraftName(event.target.value)} required maxLength={100} disabled={pending} className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2' /></FormField>
                <FormField label='Description' className='grid gap-1 text-sm' htmlFor={descriptionId}><textarea id={descriptionId} value={draftDescription} onChange={event => setDraftDescription(event.target.value)} maxLength={2000} rows={5} disabled={pending} placeholder='What does this account do?' className='resize-y rounded-lg border border-ui-border bg-ui-raised px-3 py-2' /></FormField>
                {error && <p role='alert' className='text-sm text-ui-text'>{error}</p>}
                <div className='flex justify-end gap-2'>
                    <button type='button' disabled={pending} onClick={() => dialog.current?.close()} className='rounded-lg border border-ui-border px-4 py-2 text-sm disabled:opacity-50'>Cancel</button>
                    <button disabled={pending || !draftName.trim()} className='ui-button ui-button-primary px-4 py-2 text-sm disabled:opacity-50'>{pending ? 'Saving…' : 'Save changes'}</button>
                </div>
            </form>
        </dialog>
    </>
}
