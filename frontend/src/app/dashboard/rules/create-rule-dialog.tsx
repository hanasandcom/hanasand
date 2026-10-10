'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { requestJson, type Rule } from './detection-rules'
import { ruleCategories, type RuleCategory } from './rule-categories'
import RulePreview from './rule-preview'
import ConditionBuilder, { conditionError, ruleInput, type Condition } from './condition-builder'

type RulePreset = { name: string, explanation: string, stage: string, action: string, conditions: Condition[] }

export default function CreateRuleDialog({ category, organizationId, canManage, canManageRetention, onClose, onCreated, initialPreset, storedLogsOnly = false }: { category: RuleCategory, organizationId: string, canManage: boolean, canManageRetention: boolean, onClose: () => void, onCreated: (rule: Rule) => void, initialPreset?: RulePreset, storedLogsOnly?: boolean }) {
    const dialog = useRef<HTMLDialogElement>(null)
    const active = useRef(true)
    const [name, setName] = useState(initialPreset?.name || ''), [explanation, setExplanation] = useState(initialPreset?.explanation || ''), [severity, setSeverity] = useState('medium')
    const [stage, setStage] = useState(initialPreset?.stage || (category === 'analysis' ? 'analyze' : category === 'detection' ? 'detect' : 'match'))
    const [action, setAction] = useState(initialPreset?.action || 'keep'), [conditions, setConditions] = useState<Condition[]>(initialPreset?.conditions || [{ path: 'event_type', operator: 'equals', value: '' }])
    const [busy, setBusy] = useState(false), [error, setError] = useState<{ message: string } | null>(null)
    const [editingJson, setEditingJson] = useState(false)
    const [range, setRange] = useState(initialPreset && storedLogsOnly ? 'all' : '24')
    const [readyPreview, setReadyPreview] = useState(''), [checkRequestedFor, setCheckRequestedFor] = useState(''), [previewRun, setPreviewRun] = useState(0)
    const previewKey = JSON.stringify({ organizationId, conditions, action, stage, range, editingJson })
    const previousPreviewKey = useRef(previewKey)
    const currentCheckKey = `${previewKey}:${previewRun}`
    const checkingRequested = checkRequestedFor === currentCheckKey
    const previewReady = useCallback((ready: boolean) => setReadyPreview(ready ? currentCheckKey : ''), [currentCheckKey])
    useEffect(() => {
        active.current = true
        const element = dialog.current
        element?.showModal()
        return () => { active.current = false; element?.close() }
    }, [])
    useEffect(() => {
        if (!error) return
        const timeout = window.setTimeout(() => setError(null), 3000)
        return () => window.clearTimeout(timeout)
    }, [error])
    useEffect(() => {
        if (previousPreviewKey.current !== previewKey) {
            previousPreviewKey.current = previewKey
            setCheckRequestedFor('')
        }
    }, [previewKey])
    const signature = { name, explanation, severity: action === 'drop' ? 'low' : severity, stage, action, match: 'all', conditions }
    const permitted = canManage && (stage !== 'analyze' || canManageRetention)
    const invalid = conditionError(conditions)
    async function submit() {
        if (busy || !permitted || editingJson || invalid || (checkingRequested && readyPreview !== currentCheckKey)) return
        setBusy(true); setError(null)
        try {
            const result = await requestJson<{ rule: Rule }>(`/api/backend/rules?organizationId=${encodeURIComponent(organizationId)}`, { method: 'POST', body: JSON.stringify(signature) })
            if (active.current) onCreated(result.rule)
        } catch (cause) { if (!active.current) return; setError({ message: cause instanceof Error ? cause.message : 'Could not create rule.' }); setBusy(false) }
    }
    function toggleMatchCheck() {
        if (checkingRequested && readyPreview !== currentCheckKey) { setCheckRequestedFor(''); return }
        const nextRun = previewRun + 1
        setPreviewRun(nextRun)
        setCheckRequestedFor(`${previewKey}:${nextRun}`)
    }
    return <dialog ref={dialog} id='event-rule-create' aria-labelledby='create-rule-title' onCancel={event => { event.preventDefault(); if (!busy) onClose() }} className='m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto rounded-xl border border-ui-border bg-ui-panel p-5 text-ui-text shadow-2xl backdrop:bg-ui-backdrop sm:p-6'>
        <header className='mb-5 flex items-center justify-between gap-3'><h2 id='create-rule-title' className='text-xl font-semibold'>Create rule</h2><button type='button' aria-label='Close create rule' disabled={busy} onClick={onClose} className='rounded-md border border-ui-border px-3 py-2 text-sm'>Close</button></header>
        <form onSubmit={event => { event.preventDefault(); void submit() }} className='grid min-w-0 gap-5'>
            <fieldset disabled={busy} className='grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]'>
                <div className='grid min-w-0 content-start gap-4'>
                    <label className='grid gap-1 text-sm'>Name<input autoFocus required minLength={2} maxLength={120} aria-label='Rule name' value={name} onChange={event => setName(event.target.value)} className={ruleInput} /></label>
                    <label className='grid gap-1 text-sm'>Description<textarea required minLength={10} maxLength={500} rows={2} aria-label='Rule explanation' value={explanation} onChange={event => setExplanation(event.target.value)} className={ruleInput} /></label>
                    <div className='grid gap-3 sm:grid-cols-3'>
                        <label className='grid gap-1 text-xs'>Filter<select aria-label='Rule filter' value={stage} onChange={event => { setStage(event.target.value); if (event.target.value !== 'analyze') setAction('keep') }} className={ruleInput}>{Object.entries(ruleCategories).map(([key, item]) => <option key={key} value={key === 'analysis' ? 'analyze' : key === 'detection' ? 'detect' : key}>{item.label}</option>)}</select></label>
                        <label className='grid gap-1 text-xs'>Action<select aria-label='Rule action' value={action} onChange={event => setAction(event.target.value)} className={ruleInput}><option value='keep'>Store</option>{stage === 'analyze' && <option value='drop'>Drop</option>}</select></label>
                        <label className='grid gap-1 text-xs'>Severity<select aria-label='Rule severity' disabled={action === 'drop'} value={action === 'drop' ? 'low' : severity} onChange={event => setSeverity(event.target.value)} className={ruleInput}>{['low', 'medium', 'high', 'critical'].map(value => <option key={value}>{value}</option>)}</select></label>
                    </div>
                    <div className='flex justify-between text-sm font-semibold'><h3>Conditions</h3><span className='font-mono text-xs text-ui-muted'>ALL</span></div>
                    <ConditionBuilder conditions={conditions} onChange={setConditions} onEditingJson={setEditingJson} />
                </div>
                <aside className='min-w-0 rounded-lg border border-ui-border bg-ui-raised p-4 lg:sticky lg:top-0 lg:self-start'><h3 className='mb-3 text-sm font-semibold'>Rule JSON</h3><pre aria-label='Rule JSON preview' className='max-h-[65vh] overflow-auto whitespace-pre-wrap wrap-break-word font-mono text-xs leading-6'>{JSON.stringify(signature, null, 2)}</pre></aside>
            </fieldset>
            <div className='flex flex-wrap items-center gap-3'><label className='flex items-center gap-3 text-sm'>Preview range<select aria-label='Preview range' className={ruleInput + ' max-w-48'} value={range} onChange={event => setRange(event.target.value)}><option value='1'>Last hour</option><option value='24'>Last 24 hours</option><option value='168'>Last 7 days</option><option value='all'>All stored events</option></select></label><button type='button' disabled={busy || Boolean(invalid) || editingJson} onClick={toggleMatchCheck} className='rounded-md border border-ui-border px-3 py-2 text-sm disabled:opacity-50'>{checkingRequested ? readyPreview === currentCheckKey ? 'Check again' : 'Skip check' : 'Check matches'}</button></div>
            {!invalid && !editingJson && checkingRequested && <RulePreview key={currentCheckKey} organizationId={organizationId} conditions={conditions} action={action} range={range} storedLogsOnly={storedLogsOnly} onReady={previewReady} />}
            <footer className='flex flex-wrap items-center justify-between gap-3 border-t border-ui-border pt-4'>
                <p className='text-xs text-ui-muted'>{!permitted ? 'An active Hanasand organization editor or owner is required.' : ''}</p>
                <div className='flex flex-wrap items-center gap-3'>
                    {error && <p role='alert' className='text-sm text-ui-danger'>{error.message}</p>}
                    <button type='submit' disabled={busy || !permitted || editingJson || Boolean(invalid) || (checkingRequested && readyPreview !== currentCheckKey) || name.trim().length < 2 || explanation.trim().length < 10} className='rounded-md bg-ui-primary px-4 py-2 text-sm font-semibold text-ui-on-primary disabled:opacity-50'>{busy ? 'Creating…' : 'Create rule'}</button>
                </div>
            </footer>
            {conditions.some(condition => condition.operator === 'regex' && condition.value) && invalid && <p role='alert' className='text-sm text-ui-text'>{invalid}</p>}
        </form>
    </dialog>
}
