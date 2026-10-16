'use client'

import Editor from '@/components/editor/editor'
import ErrorNotice from '@/components/error/errorNotice'
import ContentEditorHeader from '@/app/dashboard/ContentEditorHeader'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import deleteArticle from '@/utils/articles/deleteArticle'
import { putArticle } from '@/utils/articles/putArticle'
import { FileText } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function EditorClient({ article }: { article: Article }) {
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const [editing, setEditing] = useState(false)
    const [content, setContent] = useState(article.content)
    const router = useRouter()
    const name = article.id.replace('.md', '')
    const text = editing ? `Editing ${name}` : name

    async function handleDelete() {
        const result = await deleteArticle(article.id)
        if (result.status === 200) {
            router.push(`/content/articles?message=${result.message}`)
        } else {
            setError(result.message)
        }
    }

    return (
        <div className={`relative grid gap-4 ${editing ? '' : 'px-4 md:px-[18vw]'}`}>
            <ContentEditorHeader icon={FileText} label='Article editor' title={text} onDelete={handleDelete} />
            <ErrorNotice compact message={error as string | null} />
            <Editor
                customSaveLogic
                save={async () => {
                    try { await putArticle(article.id, content); setEditing(false) }
                    catch (error) { setError(error instanceof Error ? error.message : 'Could not save article.') }
                }}
                onChange={setContent}
                editing={editing}
                setEditing={setEditing}
                className='rounded-lg border border-ui-border bg-ui-raised p-2 shadow-sm shadow-ui-canvas/20'
                id={article.id}
                content={content.split('\n')}
            />
        </div>
    )
}
