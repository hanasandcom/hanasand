'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { flattenWorkspaceTree, loadWorkspaceFiles } from './workspaceFiles'
import type { IndexedWorkspaceFile, WorkspaceSearchOptions } from './types'

export function workspaceSearchRefreshKey(options: Pick<WorkspaceSearchOptions, 'caseSensitive' | 'wholeWord' | 'regex' | 'include' | 'exclude'>) {
    return JSON.stringify([options.caseSensitive, options.wholeWord, options.regex, options.include, options.exclude])
}

type Props = {
    tree: Tree | null
    share: Share | null
    editingContent: string
    query: string
    refreshKey?: string
    delay: number
    onClear: () => void
    onLoaded: (files: IndexedWorkspaceFile[]) => void
    onError?: (error: unknown) => void
}

export function useWorkspaceFileIndex(props: Props) {
    const { tree, share, editingContent, query, delay, refreshKey = '' } = props
    const files = useMemo(() => flattenWorkspaceTree(tree), [tree])
    const cache = useRef(new Map<string, IndexedWorkspaceFile>())
    const callbacks = useRef(props)
    const [loading, setLoading] = useState(false)
    callbacks.current = props

    useEffect(() => {
        if (!query.trim() || !files.length) {
            callbacks.current.onClear()
            return
        }

        let cancelled = false
        const timeout = window.setTimeout(() => {
            setLoading(true)
            void loadWorkspaceFiles({ files, activeShare: share, activeContent: editingContent, cache: cache.current })
                .then(indexed => { if (!cancelled) callbacks.current.onLoaded(indexed) }, error => {
                    console.error(error)
                    if (!cancelled) callbacks.current.onError?.(error)
                })
                .finally(() => { if (!cancelled) setLoading(false) })
        }, delay)

        return () => { cancelled = true; window.clearTimeout(timeout) }
    }, [delay, editingContent, files, query, refreshKey, share])

    return { files, loading, cache: cache.current }
}
