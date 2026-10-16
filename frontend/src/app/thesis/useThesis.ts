'use client'

import { useEffect, useRef, useState } from 'react'
import type { ThesisDocument } from '@/utils/thesis'
import { findRecoveries, removeRecoveredDraft, sameThesis, writeRecovery, type Recovery } from './thesisRecovery'
import { createThesisTransport } from './thesisTransport'
import { ThesisUndoHistory } from './thesisUndoHistory'

export default function useThesis(initial: ThesisDocument, canEdit: boolean) {
    const [document, setDocument] = useState(initial)
    const [undoState, setUndoState] = useState({ undo: 0, redo: 0 })
    const [error, setError] = useState('')
    const [conflict, setConflict] = useState(false)
    const [recoveries, setRecoveries] = useState<Recovery[]>([])
    const actions = useRef<{
        receive(document: ThesisDocument): void
        update(field: 'title' | 'body', value: string, group?: string): void
        undo(): void
        redo(): void
        flush(): Promise<boolean>
        restore(document: ThesisDocument): Promise<boolean>
        recover(recovery: Recovery): void
        resolve(keepDraft: boolean): void
    } | null>(null)

    useEffect(() => {
        let draft = initial
        let base = initial
        let remote: ThesisDocument | null = null
        let key = ''
        let recovered: Recovery | null = null
        const sentRef = { current: null as ThesisDocument | null }
        const history = new ThesisUndoHistory(setUndoState)
        function travel(redo: boolean) {
            if (!canEdit || remote) return
            const previous = history.travel(draft, base.revision, redo)
            if (!previous) return
            draft = previous
            setDocument(draft)
            keepDraft()
            schedule()
        }
        const dirty = () => !sameThesis(draft, base)

        function keepDraft() {
            if (!key || !canEdit) return
            try {
                writeRecovery(key, draft, dirty() || Boolean(sentRef.current && !sameThesis(draft, sentRef.current)))
            } catch {
                setError('Browser recovery storage is unavailable. Keep this page open until your changes reach the server.')
            }
        }

        function receive(next: ThesisDocument) {
            if (!Number.isSafeInteger(next.revision) || typeof next.title !== 'string' || typeof next.body !== 'string' || next.revision < base.revision) return
            if (next.revision === base.revision) return
            if (dirty() && !sameThesis(draft, next) && !(sentRef.current && sameThesis(sentRef.current, next))) {
                remote = next
                setConflict(true)
                setError('Another tab changed the thesis. Your draft is kept in this browser.')
                return
            }
            const preserveDraft = !sameThesis(draft, next) && (dirty() || Boolean(sentRef.current && sameThesis(sentRef.current, next)))
            if (!preserveDraft && !sameThesis(draft, next)) history.clear()
            remote = null
            setConflict(false)
            setError('')
            base = next
            draft = preserveDraft ? { ...draft, revision: next.revision } : next
            setDocument(draft)
            keepDraft()
            schedule()
        }

        const transport = createThesisTransport({
            canEdit,
            getDraft: () => draft,
            getBase: () => base,
            isDirty: dirty,
            hasConflict: () => Boolean(remote),
            receive,
            keepDraft,
            sentRef,
            onConflict: next => {
                remote = next
                setConflict(true)
                setError('Another tab changed the thesis. Your draft is kept in this browser.')
            },
            onAccepted: next => {
                base = next
                draft = next
            },
            onSaved: () => {
                if (recovered) {
                    removeRecoveredDraft(recovered)
                    const recoveredKey = recovered.key
                    recovered = null
                    setRecoveries(items => items.filter(item => item.key !== recoveredKey))
                }
                setError('')
            },
            setError,
        })
        const schedule = () => transport.schedule()
        const flush = () => transport.flush()

        actions.current = {
            receive,
            update(field, value, group) {
                if (!canEdit || draft[field] === value) return
                history.remember(draft, group)
                draft = { ...draft, [field]: value, revision: remote ? draft.revision : base.revision }
                setDocument(draft)
                keepDraft()
                schedule()
            },
            undo: () => travel(false),
            redo: () => travel(true),
            flush,
            async restore(version) {
                do { if (!await flush()) return false } while (dirty())
                if (!sameThesis(draft, version)) history.remember(draft)
                draft = { title: version.title, body: version.body, revision: base.revision }
                setDocument(draft)
                keepDraft()
                return flush()
            },
            recover(version) {
                if (dirty()) { setError('Wait for the current edit to reach the server before recovering another draft.'); return }
                history.clear()
                recovered = version
                draft = version
                setDocument(draft)
                if (version.revision !== base.revision && !sameThesis(version, base)) {
                    remote = base
                    setConflict(true)
                    setError('This recovered draft is based on an older version. Choose which text to keep.')
                }
                keepDraft()
                schedule()
            },
            resolve(keep) {
                if (!remote) return
                history.clear()
                base = remote
                draft = keep ? { ...draft, revision: base.revision } : base
                remote = null
                setConflict(false)
                setError('')
                setDocument(draft)
                keepDraft()
                schedule()
            },
        }

        if (canEdit) {
            try {
                const candidates = findRecoveries(initial)
                key = candidates.key
                if (candidates.own) actions.current!.recover(candidates.own)
                setRecoveries(candidates.others)
            } catch {
                setError('Browser recovery storage is unavailable. Keep this page open until your changes reach the server.')
            }
        }

        return transport.start()
    // Server refreshes must update the document without recreating its local Undo history.
    }, [canEdit])

    useEffect(() => { actions.current?.receive(initial) }, [initial])

    return {
        document, error, conflict, recoveries,
        update: (field: 'title' | 'body', value: string, group?: string) => actions.current?.update(field, value, group),
        canUndo: canEdit && !conflict && undoState.undo > 0,
        canRedo: canEdit && !conflict && undoState.redo > 0,
        undo: () => actions.current?.undo(),
        redo: () => actions.current?.redo(),
        flush: () => actions.current?.flush() ?? Promise.resolve(false),
        restore: (version: ThesisDocument) => actions.current?.restore(version) ?? Promise.resolve(false),
        recover: (version: Recovery) => actions.current?.recover(version),
        resolve: (keepDraft: boolean) => actions.current?.resolve(keepDraft),
    }
}
