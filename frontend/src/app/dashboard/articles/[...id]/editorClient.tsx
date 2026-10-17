'use client'

import SavedContentEditor from '@/app/dashboard/SavedContentEditor'
import deleteArticle from '@/utils/articles/deleteArticle'
import { putArticle } from '@/utils/articles/putArticle'
import { FileText } from 'lucide-react'
import { useState } from 'react'

export default function EditorClient({ article }: { article: Article }) {
    const [content, setContent] = useState(article.content)
    const name = article.id.replace('.md', '')
    return <SavedContentEditor
        icon={FileText}
        label='Article editor'
        title={name}
        editingTitle={`Editing ${name}`}
        id={article.id}
        content={content.split('\n')}
        onChange={setContent}
        onSave={() => putArticle(article.id, content)}
        deleteContent={() => deleteArticle(article.id)}
        successHref={message => `/content/articles?message=${message}`}
    />
}
