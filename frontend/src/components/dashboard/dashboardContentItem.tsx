'use client'

import deleteArticle from '@/utils/articles/deleteArticle'
import deleteThought from '@/utils/thoughts/deleteThought'
import useKeyPress from '@/hooks/keyPressed'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import ErrorNotice from '../error/errorNotice'
import { BrainCircuit, FileText, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
    kind: 'article' | 'thought'
    id: string
    title: string
}

export function dashboardContentPath(kind: Props['kind'], id: string) {
    return kind === 'article' ? `/articles/${id}` : `/thought/${id}`
}

export function dashboardContentDeletedMessage(kind: Props['kind'], id: string) {
    return `Deleted ${kind} ${id}.`
}

export default function DashboardContentItem({ kind, id, title }: Props) {
    const [deleted, setDeleted] = useState(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const keys = useKeyPress('shift')
    const router = useRouter()
    const isArticle = kind === 'article'
    const Icon = isArticle ? FileText : BrainCircuit
    const deleteItem = isArticle ? deleteArticle : deleteThought
    const displayTitle = title || id

    async function handleClick() {
        if (!keys['shift']) {
            router.push(dashboardContentPath(kind, id))
        }

        if (keys['shift']) {
            const result = await deleteItem(id)
            if (result.status === 200) {
                setDeleted(true)
            } else {
                setError(result.message)
            }
        }
    }

    return (
        <div className='group grid gap-2'>
            <button
                type='button'
                onClick={handleClick}
                className={`flex min-w-0 cursor-pointer items-center justify-between gap-3 rounded-lg p-2 text-left transition ${keys['shift'] ? 'border border-ui-danger/40 bg-ui-raised/10 text-ui-text hover:bg-ui-raised/15' : 'text-ui-text hover:bg-ui-raised'}`}
            >
                <span className='flex min-w-0 items-center gap-2'>
                    <Icon className='h-4 w-4 shrink-0 text-ui-primary' />
                    <span className='min-w-0 truncate text-sm'>{displayTitle}</span>
                </span>
                {keys['shift'] && <Trash2 className='h-4 w-4 shrink-0 text-ui-text' />}
            </button>
            <ErrorNotice compact variant='success' message={deleted ? dashboardContentDeletedMessage(kind, id) : null} />
            <ErrorNotice compact message={error as string | null} />
        </div>
    )
}
