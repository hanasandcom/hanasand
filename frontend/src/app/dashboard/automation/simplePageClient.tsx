'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AgentAutomation, AutomationPayload } from '@/utils/automations/client'
import { createAutomation, deleteAutomation, fetchAutomation, fetchAutomations, runAutomationNow, updateAutomation } from '@/utils/automations/client'
import type { InitialAutomationData } from '@/utils/automations/server'
import useAutomationHistory from './useAutomationHistory'
import ErrorNotice from '@/components/error/errorNotice'
import { defaultAutomationDraft, newAutomationDraft, toAutomationDraft, validateAutomationDraft } from './automationDraft'
import AutomationListPanel from './automationListPanel'
import { AutomationForm } from './automationForm'
import { AutomationDetails } from './automationDetails'
import { StatusSummary, WelcomeState } from './automationListPanel'

export default function AutomationsClient({ setup, initial, mode = 'health', systemJobCount }: { setup?: 'dwm', initial: InitialAutomationData, mode?: 'health' | 'cron', systemJobCount?: number }) {
    const router = useRouter()
    const [automations, setAutomations] = useState<AgentAutomation[]>(initial.automations)
    const [canManageSystem, setCanManageSystem] = useState(Boolean(initial.canManageSystem))
    const scope = mode === 'cron' ? 'personal' as const : undefined
    const [detailsOpen, setDetailsOpen] = useState(true)
    const [selected, setSelected] = useState<AgentAutomation | null>(setup ? null : initial.detail?.automation || initial.automations[0] || null)
    const [draft, setDraft] = useState<AutomationPayload>(() => selected ? toAutomationDraft(selected) : { ...defaultAutomationDraft(), timezone: 'UTC' })
    const [historyFrom, setHistoryFrom] = useState('')
    const [historyTo, setHistoryTo] = useState('')
    const history = useAutomationHistory(selected?.id, historyFrom, historyTo, initial.detail, initial.error)
    const [showHistoryFilters, setShowHistoryFilters] = useState(false)
    const [editing, setEditing] = useState(Boolean(setup))
    const [busy, setBusy] = useState('')
    const [message, setMessage] = useState(initial.error || '')
    const [loadError, setLoadError] = useState(initial.error || '')

    async function load(selectedId = selected?.id) {
        setBusy('load')
        try {
            const result = await fetchAutomations(scope)
            setCanManageSystem(Boolean(result.canManageSystem))
            setLoadError('')
            setAutomations(result.automations || [])
            const next = (result.automations || []).find(item => item.id === selectedId) || (result.automations || [])[0] || null
            if (next) await select(next, false)
            else setSelected(null)
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : 'Unable to load automations.')
        } finally {
            setBusy('')
        }
    }

    useEffect(() => {
        if (editing) return
        const refresh = window.setInterval(() => {
            void fetchAutomations(scope).then(result => {
                setCanManageSystem(Boolean(result.canManageSystem))
                setAutomations(result.automations)
                const fresh = result.automations.find(item => item.id === selected?.id) || result.automations[0] || null
                setSelected(fresh)
            }).catch(() => undefined)
        }, 15_000)
        return () => window.clearInterval(refresh)
    }, [editing, selected?.id, scope])

    async function select(automation: AgentAutomation, openEditor = false) {
        setSelected(automation)
        setDraft(toAutomationDraft(automation))
        setEditing(openEditor)
        try {
            const result = await fetchAutomation(automation.id)
            setSelected(result.automation)
            setDraft(toAutomationDraft(result.automation))
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to load automation history.')
        }
    }

    function beginCreate() {
        setDetailsOpen(true)
        setSelected(null)
        setHistoryFrom('')
        setHistoryTo('')
        setShowHistoryFilters(false)
        setDraft(newAutomationDraft(mode))
        setEditing(true)
        setMessage('')
    }

    async function save() {
        const validation = validateAutomationDraft(draft)
        if (validation) {
            setMessage(validation.message)
            return
        }
        setBusy('save')
        try {
            const result = selected ? await updateAutomation(selected.id, draft) : await createAutomation(draft)
            setMessage(selected ? 'Automation updated.' : 'Automation created.')
            setEditing(false)
            await load(result.automation.id)
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to save automation.')
        } finally {
            setBusy('')
        }
    }

    async function runNow() {
        if (!selected) return
        setBusy('run')
        try {
            await runAutomationNow(selected.id)
            setMessage('Check started. Refresh shortly to see the result.')
            await select(selected, false)
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to start the check.')
        } finally {
            setBusy('')
        }
    }

    async function remove() {
        if (!selected || !window.confirm(`Delete “${selected.name}”?`)) return
        setBusy('delete')
        try {
            await deleteAutomation(selected.id)
            setMessage('Automation deleted.')
            await load('')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to delete automation.')
        } finally {
            setBusy('')
        }
    }

    if (!automations.length && loadError) return <ErrorNotice message={loadError} actionLabel={busy ? 'Retrying…' : 'Try again'} onAction={() => void load()} />
    if (!automations.length && !editing) return <div className='grid min-h-64 place-items-center rounded-xl border border-ui-border bg-ui-panel p-6 text-center'><div>
        <h2 className='text-xl font-semibold text-ui-text'>{mode === 'cron' ? 'No jobs' : 'No health checks yet'}</h2>
        {mode === 'cron' && systemJobCount ? <button type='button' onClick={() => router.push('/automation/cron?scope=system')} className='mx-auto mt-2 block w-fit text-center text-sm font-normal text-ui-primary hover:underline'>System jobs ({systemJobCount})</button> : <p className='mt-2 text-sm text-ui-muted'>{mode === 'cron' ? 'Got something to keep an eye on? Schedule it here.' : 'Add your first check to start monitoring a service.'}</p>}
        <button type='button' onClick={beginCreate} className='mx-auto mt-4 block min-w-40 rounded-lg bg-ui-primary px-6 py-2 text-sm font-semibold text-ui-on-primary'>{mode === 'cron' ? 'Create job' : 'Create health check'}</button>
    </div></div>

    return <div className='grid gap-4'>
        <StatusSummary automations={automations} />
        <div className={`grid gap-4 ${detailsOpen ? 'xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]' : ''}`}>
            <AutomationListPanel
                automations={automations}
                mode={mode}
                detailsOpen={detailsOpen}
                editing={editing}
                selectedId={selected?.id}
                onToggleDetails={() => setDetailsOpen(!detailsOpen)}
                onCreate={beginCreate}
                onSelect={automation => { setDetailsOpen(true); void select(automation) }}
            />
            <section id='health-check-details' hidden={!detailsOpen} className='rounded-xl border border-ui-border bg-ui-panel p-4 shadow-sm'>
                {editing ? <AutomationForm
                    canManageSystem={canManageSystem}
                    draft={draft}
                    selected={selected}
                    busy={busy}
                    message={message}
                    onChange={setDraft}
                    onSave={() => void save()}
                    onCancel={() => { setEditing(false); setMessage('') }}
                /> : selected ? <AutomationDetails
                    automation={selected}
                    runs={history.runs}
                    history={history}
                    historyFrom={historyFrom}
                    historyTo={historyTo}
                    onHistoryFromChange={setHistoryFrom}
                    onHistoryToChange={setHistoryTo}
                    showHistoryFilters={showHistoryFilters}
                    onShowHistoryFiltersChange={setShowHistoryFilters}
                    busy={busy}
                    message={message}
                    onRun={() => void runNow()}
                    onEdit={() => setEditing(true)}
                    onDelete={() => void remove()}
                    onRefresh={history.refresh}
                /> : <WelcomeState onCreate={beginCreate} compact />}
            </section>
        </div>
    </div>
}
