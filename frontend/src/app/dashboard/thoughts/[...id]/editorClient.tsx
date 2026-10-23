'use client'

import SavedContentEditor from '@/app/dashboard/SavedContentEditor'
import deleteThought from '@/utils/thoughts/deleteThought'
import putThought from '@/utils/thoughts/putThought'
import { BrainCircuit } from 'lucide-react'
import { useState } from 'react'

export default function EditorClient({ thought }: { thought: Thought }) {
    const [title, setTitle] = useState(thought.title)

    return <SavedContentEditor
        icon={BrainCircuit}
        label='Thought editor'
        title='Thought'
        editingTitle='Editing thought'
        id={thought.id}
        content={title.split('\n')}
        onChange={setTitle}
        onSave={() => putThought(thought.id, title)}
        deleteContent={() => deleteThought(thought.id)}
        successHref={message => `/content/thoughts?message=${message}`}
    />
}
