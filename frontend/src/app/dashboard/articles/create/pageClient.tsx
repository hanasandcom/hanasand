'use client'

import CreateContentEditor from '@/app/dashboard/CreateContentEditor'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import fetchArticle from '@/utils/articles/fetchArticle'
import { postArticle } from '@/utils/articles/postArticle'
import { FilePlus2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function CreateClient() {
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const [id, setId] = useState<string | null>(null)
    const [content, setContent] = useState<string>('')
    const [editing, setEditing] = useState(false)
    const router = useRouter()
    const name = (id || '').replace('.md', '')
    const text = editing ? `Creating ${name}` : 'Start writing...'

    async function handleCreate() {
        if (!id) {
            return setError('Please provide a name before creating the article.')
        }

        if (!content) {
            return setError('You cannot create an empty article.')
        }

        const result = await postArticle(id, content)
        if (result.status === 200 || result.status === 201) {
            router.push(`/content/articles?message=${result.message}`)
        } else {
            setError(result.message)
        }
    }

    useEffect(() => {
        if (id) {
            (async() => {
                const response = await fetchArticle(id)
                if (response) {
                    setError(`The article id ${id} is already taken!`)
                }
            })()
        }
    }, [id])

    useEffect(() => {
        if (!content.length) {
            setEditing(false)
        }
    }, [content])

    return (
        <CreateContentEditor
            icon={FilePlus2}
            label='Article editor'
            title={text}
            error={error as string | null}
            editing={editing}
            setEditing={setEditing}
            id={id || ''}
            content={content.split('\n')}
            onChange={setContent}
            onCreate={handleCreate}
            editorGap='gap-4'
        >
            {content.length > 10 ? (
                <div className='grid gap-2'>
                    <label className='text-sm font-medium text-ui-text'>Article ID</label>
                    <input
                        value={id || ''}
                        placeholder='example.md'
                        onChange={(e) => setId(e.target.value.replaceAll('.md', ''))}
                        className='h-10 w-full rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/35'
                    />
                </div>
            ) : <></>}
        </CreateContentEditor>
    )
}
