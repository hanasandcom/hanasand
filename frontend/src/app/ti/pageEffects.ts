'use client'

import searchThreatIntel from '@/utils/ti/search'
import { humanizeSlug } from '../seo'
import { rememberSearch } from '@/components/ti/searchSuggestions'
import { useEffect } from 'react'
import { updateCanonical, updateMetaDescription } from './pageMeta'
import type { PublicTiPageEffectsProps } from './pageConstants'

export function usePublicTiPageEffects({ initialQuery, initialResult, query, result, setQuery, setResult, setBusy, setError, activeQueryRef, requestSeqRef }: PublicTiPageEffectsProps) {
    useEffect(() => { if (initialQuery.trim()) rememberSearch(initialQuery) }, [initialQuery])

    useEffect(() => {
        document.body.dataset.publicTiRoute = 'true'
        return () => {
            delete document.body.dataset.publicTiRoute
        }
    }, [])

    useEffect(() => {
        activeQueryRef.current = query.trim().toLowerCase()
    }, [query])

    useEffect(() => {
        const titleQuery = (result?.query || query).trim()
        if (!titleQuery) {
            document.title = 'Threat Intelligence Search | Hanasand'
            return
        }

        const label = humanizeSlug(titleQuery)
        document.title = `${label} Threat Intelligence | Hanasand`
        updateMetaDescription(`Search Hanasand monitoring context for ${label}: actor names, company mentions, domains, and recent claims.`)
        updateCanonical(`/ti/${encodeURIComponent(titleQuery)}`)
    }, [query, result?.query])

    useEffect(() => {
        const clean = initialQuery.trim()
        if (!clean || initialResult) return

        const cleanKey = clean.toLowerCase()
        const requestSeq = requestSeqRef.current + 1
        requestSeqRef.current = requestSeq
        activeQueryRef.current = cleanKey
        setBusy(true)
        setQuery(clean)
        searchThreatIntel(clean, { preferCached: true })
            .then((next) => {
                if (requestSeqRef.current !== requestSeq || activeQueryRef.current !== cleanKey) return
                if (next) {
                    setError('')
                    setResult(next)
                }
                else setError('Threat intelligence search is temporarily unavailable.')
            })
            .finally(() => {
                if (requestSeqRef.current === requestSeq) setBusy(false)
            })
    }, [initialQuery, initialResult])

    useEffect(() => {
        if (!result?.refreshAfterSeconds || result.status === 'ready' || result.status === 'unavailable') return
        const expectedQuery = result.query
        const expectedKey = expectedQuery.trim().toLowerCase()
        const timer = window.setTimeout(async () => {
            const next = await searchThreatIntel(expectedQuery, { bypassCache: true })
            if (next && activeQueryRef.current === expectedKey) {
                setError('')
                setResult(next)
            } else if (activeQueryRef.current === expectedKey) {
                setError('Threat intelligence search is temporarily unavailable.')
            }
        }, Math.max(3, result.refreshAfterSeconds) * 1000)

        return () => window.clearTimeout(timer)
    }, [result])
}
