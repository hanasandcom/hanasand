'use client'

import CreateContentEditor from '@/app/dashboard/CreateContentEditor'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import fetchThoughtByTitle from '@/utils/thoughts/fetchThoughtByTitle'
import { postThought } from '@/utils/thoughts/postThought'
import { BrainCircuit } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function CreateClient() {
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const [title, setTitle] = useState<string>('')
    const [editing, setEditing] = useState(false)
    const router = useRouter()
    const text = editing ? 'Creating thought' : 'Start writing...'

    async function handleCreate() {
        if (!title) {
            return setError('You cannot create an empty thought.')
        }

        const result = await postThought(title)
        if (result.status === 201) {
            return router.push(`/content/thoughts?message=${JSON.stringify(result.message)}`)
        } else {
            return setError(result.message)
        }
    }

    useEffect(() => {
        if (title) {
            (async() => {
                const response = await fetchThoughtByTitle(title)
                if (Array.isArray(response) && response.length > 0) {
                    setError('The thought already exists!')
                }
            })()
        }
    }, [title])

    useEffect(() => {
        if (!title.length) {
            setEditing(false)
        }
    }, [title])

    return (
        <CreateContentEditor
            icon={BrainCircuit}
            label='Thought editor'
            title={text}
            error={error as string | null}
            editing={editing}
            setEditing={setEditing}
            id={title || ''}
            content={title.split('\n')}
            onChange={setTitle}
            onCreate={handleCreate}
            editorGap='gap-5'
        />
    )
}
