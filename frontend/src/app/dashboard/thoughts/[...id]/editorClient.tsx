'use client'

import SavedContentEditor from '@/app/dashboard/SavedContentEditor'
import deleteThought from '@/utils/thoughts/deleteThought'
import { BrainCircuit } from 'lucide-react'

export default function EditorClient({ thought }: { thought: Thought }) {
    return <SavedContentEditor
        icon={BrainCircuit}
        label='Thought editor'
        title='Thought'
        editingTitle='Editing thought'
        id={thought.id}
        content={thought.title.split('\n')}
        deleteContent={() => deleteThought(thought.id)}
        successHref={message => `/content/thoughts?message=${message}`}
    />
}
