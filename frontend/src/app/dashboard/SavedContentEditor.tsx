'use client'

import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import Editor from '@/components/editor/editor'
import ErrorNotice from '@/components/error/errorNotice'
import ContentEditorHeader from './ContentEditorHeader'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { useRouter } from 'next/navigation'

type DeleteResult = { status: number, message: string }
type Props = {
    icon: LucideIcon, label: string, title: string, editingTitle: string
    id: string, content: string[], deleteContent: () => Promise<DeleteResult>
    successHref: (message: string) => string
    onChange?: (value: string) => void, onSave?: () => Promise<unknown>
}

export default function SavedContentEditor({ icon, label, title, editingTitle, id, content, deleteContent, successHref, onChange, onSave }: Props) {
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const [editing, setEditing] = useState(false)
    const router = useRouter()

    async function handleDelete() {
        const result = await deleteContent()
        if (result.status === 200) router.push(successHref(result.message))
        else setError(result.message)
    }

    async function handleSave() {
        try {
            await onSave?.()
            setEditing(false)
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Could not save article.')
            throw error
        }
    }

    return <div className={`relative grid gap-4 ${editing ? '' : 'px-4 md:px-[18vw]'}`}>
        <ContentEditorHeader icon={icon} label={label} title={editing ? editingTitle : title} onDelete={() => void handleDelete()} />
        <ErrorNotice compact message={error as string | null} />
        <Editor
            {...(onSave ? { customSaveLogic: true as const, save: handleSave, onChange } : {})}
            editing={editing} setEditing={setEditing}
            className='rounded-lg border border-ui-border bg-ui-raised p-2 shadow-sm shadow-ui-canvas/20' id={id} content={content}
        />
    </div>
}
