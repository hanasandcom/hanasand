'use client'

import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react'
import { updateShare } from '@/utils/share/put'
import {
    WorkspaceFileMatches,
    countMatches,
    flattenWorkspaceTree,
    loadWorkspaceFiles,
    replaceInContent,
    searchIndexedFiles,
    type IndexedWorkspaceFile,
} from './workspaceSearchUtils'
import { WorkspaceSearchControls } from './workspaceSearch/WorkspaceSearchControls'
import { WorkspaceSearchResults } from './workspaceSearch/WorkspaceSearchResults'

type WorkspaceSearchPanelProps = {
    tree: Tree | null
    share: Share | null
    editingContent: string
    setShare: Dispatch<SetStateAction<Share | null>>
    setEditorPatch: Dispatch<SetStateAction<{ value: string; nonce: number } | null>>
    setError: Dispatch<SetStateAction<string | boolean | null>>
}

export default function WorkspaceSearchPanel({
    tree,
    share,
    editingContent,
    setShare,
    setEditorPatch,
    setError,
}: WorkspaceSearchPanelProps) {
    const [query, setQuery] = useState('')
    const [replacement, setReplacement] = useState('')
    const [include, setInclude] = useState('')
    const [exclude, setExclude] = useState('node_modules,.next,dist,build')
    const [caseSensitive, setCaseSensitive] = useState(false)
    const [wholeWord, setWholeWord] = useState(false)
    const [regex, setRegex] = useState(false)
    const [loading, setLoading] = useState(false)
    const [replacing, setReplacing] = useState(false)
    const [results, setResults] = useState<WorkspaceFileMatches[]>([])
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const cacheRef = useRef(new Map<string, IndexedWorkspaceFile>())
    const files = useMemo(() => flattenWorkspaceTree(tree), [tree])
    const resultCount = countMatches(results)

    useEffect(() => {
        const search = query.trim()
        if (!search || !files.length) {
            setResults([])
            return
        }

        let cancelled = false
        const timeout = window.setTimeout(async () => {
            setLoading(true)
            try {
                const indexed = await loadWorkspaceFiles({
                    files,
                    activeShare: share,
                    activeContent: editingContent,
                    cache: cacheRef.current,
                })
                const nextResults = searchIndexedFiles(indexed, search, {
                    caseSensitive,
                    wholeWord,
                    regex,
                    include,
                    exclude,
                })

                if (!cancelled) {
                    setResults(nextResults)
                    setExpanded(new Set(nextResults.slice(0, 8).map(group => group.file.id)))
                }
            } catch (error) {
                console.error(error)
                if (!cancelled) {
                    setError('Search failed. Check the query or regex syntax.')
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }, 220)

        return () => {
            cancelled = true
            window.clearTimeout(timeout)
        }
    }, [caseSensitive, editingContent, exclude, files, include, query, regex, setError, share, wholeWord])

    async function replaceAll() {
        if (!query.trim() || !resultCount) {
            return
        }

        setReplacing(true)
        try {
            let changedFiles = 0
            for (const group of results) {
                const cached = cacheRef.current.get(group.file.id)
                if (!cached) {
                    continue
                }

                const nextContent = replaceInContent(cached.content, query, replacement, {
                    caseSensitive,
                    wholeWord,
                    regex,
                    include,
                    exclude,
                })

                if (nextContent === cached.content) {
                    continue
                }

                const updated = await updateShare(group.file.id, { content: nextContent })
                if (!updated) {
                    setError(`Could not update ${group.file.path}.`)
                    continue
                }

                changedFiles += 1
                const nextCached = { ...cached, content: nextContent }
                cacheRef.current.set(group.file.id, nextCached)
                if (share?.id === group.file.id) {
                    setShare(updated)
                    setEditorPatch({ value: nextContent, nonce: Date.now() })
                }
            }

            setError(changedFiles
                ? `Replaced ${resultCount} matches across ${changedFiles} files.`
                : 'No files changed.'
            )
        } catch (error) {
            console.error(error)
            setError('Replace failed. Nothing else was changed after the error.')
        } finally {
            setReplacing(false)
        }
    }

    function toggleExpanded(id: string) {
        setExpanded(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    return (
        <section className='flex h-full w-[min(22rem,calc(100vw-5rem))] flex-col overflow-hidden rounded-xl border border-ui-border bg-ui-panel shadow-2xl backdrop-blur-md md:min-w-77.5 md:max-w-105'>
            <WorkspaceSearchControls
                fileCount={files.length}
                query={query}
                replacement={replacement}
                include={include}
                exclude={exclude}
                caseSensitive={caseSensitive}
                wholeWord={wholeWord}
                regex={regex}
                resultCount={resultCount}
                groupCount={results.length}
                loading={loading}
                replacing={replacing}
                onQueryChange={setQuery}
                onReplacementChange={setReplacement}
                onIncludeChange={setInclude}
                onExcludeChange={setExclude}
                onToggleCaseSensitive={() => setCaseSensitive(value => !value)}
                onToggleWholeWord={() => setWholeWord(value => !value)}
                onToggleRegex={() => setRegex(value => !value)}
                onReplaceAll={() => void replaceAll()}
            />
            <WorkspaceSearchResults query={query} loading={loading} caseSensitive={caseSensitive} results={results} expanded={expanded} onToggleExpanded={toggleExpanded} />
        </section>
    )
}
