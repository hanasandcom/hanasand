'use client'

import Editor from '@/components/editor/editor'
import ErrorNotice from '@/components/error/errorNotice'
import ContentEditorHeader from '@/app/dashboard/ContentEditorHeader'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import deleteThought from '@/utils/thoughts/deleteThought'
import { BrainCircuit } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function EditorClient({ thought }: { thought: Thought }) {
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const [editing, setEditing] = useState(false)
    const router = useRouter()
    const text = editing ? 'Editing thought' : 'Thought'

    async function handleDelete() {
        const result = await deleteThought(thought.id)
        if (result.status === 200) {
            router.push(`/content/thoughts?message=${result.message}`)
        } else {
            setError(result.message)
        }
    }

    return (
        <div className={`relative grid gap-4 ${editing ? '' : 'px-4 md:px-[18vw]'}`}>
            <ContentEditorHeader icon={BrainCircuit} label='Thought editor' title={text} onDelete={handleDelete} />
            <ErrorNotice compact message={error as string | null} />
            <Editor
                editing={editing}
                setEditing={setEditing}
                className='rounded-lg border border-ui-border bg-ui-raised p-2 shadow-sm shadow-ui-canvas/20'
                id={thought.id}
                content={thought.title.split('\n')}
            />
        </div>
    )
}
