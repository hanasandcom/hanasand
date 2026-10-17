import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import randomId from '@/utils/random/randomId'
import { normalizeRequestHeaders, sendFromBrowser, sendViaShareVm, sendViaWorkspaceApi, withRequestDetails } from '@/utils/box/requestTool'
import type { ClipboardEvent, SyntheticEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import RequestControls from './RequestControls'
import RequestEditor from './RequestEditor'
import RequestRunHistory from './RequestRunHistory'
import ResponsePanel from './ResponsePanel'
import { loadScopedRequestVariables, saveScopedRequestVariables } from './storage'
import { buildRequestHeaders, buildVariablePlan, findMissingVariables, normalizeHeaderRows, normalizeVariableRows, resolveTemplate } from './requestTemplates'
import { parseCurlCommand } from './curlImport'
import { headerRowsFromObject, uniqueWarnings } from './requestPresentation'
import { redactSensitiveText, sanitizeToolResponse } from './responseSafety'
import { getImagePreviewUrl } from './responsePreview'
import type { NewRequestProps } from './newRequestPublicTypes'
import type { RequestEditorTab, RequestRun, ResponseTab } from './newRequestTypes'
import type { HeaderRow, ToolResponse, VariableRow } from './types'

export default function NewRequest({ initialRequest, selectedRequestId, runToken, onRequestComplete, share }: NewRequestProps) {
    const [method, setMethod] = useState(initialRequest.method)
    const [url, setUrl] = useState(initialRequest.url)
    const [headers, setHeaders] = useState<HeaderRow[]>(normalizeHeaderRows(initialRequest.headers))
    const [body, setBody] = useState(initialRequest.body)
    const [tab, setTab] = useState<RequestEditorTab>('headers')
    const [responseTab, setResponseTab] = useState<ResponseTab>('response')
    const [runs, setRuns] = useState<RequestRun[]>([])
    const [activeRunId, setActiveRunId] = useState<string | null>(null)
    const [variables, setVariables] = useState<VariableRow[]>([{ key: 'baseUrl', value: 'https://api.hanasand.com' }])
    const [treeFilter, setTreeFilter] = useState('')
    const [headerFilter, setHeaderFilter] = useState('')
    const [aiPrompt, setAiPrompt] = useState('Explain this response and suggest a next request.')
    const [aiResponse, setAiResponse] = useState('')
    const [aiLoading, setAiLoading] = useState(false)
    const inputRef = useRef<HTMLInputElement | null>(null)
    const lastRunTokenRef = useRef(runToken)

    useEffect(() => {
        setMethod(initialRequest.method); setUrl(initialRequest.url)
        setHeaders(normalizeHeaderRows(initialRequest.headers)); setBody(initialRequest.body)
    }, [initialRequest.body, initialRequest.headers, initialRequest.method, initialRequest.url, selectedRequestId])
    useEffect(() => {
        const loaded = loadScopedRequestVariables(share?.alias || share?.id || null)
        setVariables(loaded.length ? loaded : [{ key: 'baseUrl', value: 'https://api.hanasand.com' }])
    }, [share?.alias, share?.id])
    useEffect(() => { inputRef.current?.focus() }, [])

    const normalizedHeaders = useMemo(() => normalizeHeaderRows(headers), [headers])
    const normalizedVariables = useMemo(() => normalizeVariableRows(variables), [variables])
    const variablePlan = useMemo(() => buildVariablePlan(normalizedVariables), [normalizedVariables])
    const resolvedUrl = useMemo(() => resolveTemplate(url, variablePlan.values), [url, variablePlan.values])
    const resolvedBody = useMemo(() => resolveTemplate(body, variablePlan.values), [body, variablePlan.values])
    const resolvedHeaders = useMemo(() => buildRequestHeaders(normalizedHeaders, variablePlan.values), [normalizedHeaders, variablePlan.values])
    const templateWarnings = useMemo(() => uniqueWarnings([
        ...variablePlan.warnings, ...findMissingVariables(url, variablePlan.values), ...findMissingVariables(body, variablePlan.values),
        ...normalizedHeaders.flatMap((header) => [...findMissingVariables(header.key, variablePlan.values), ...findMissingVariables(header.value, variablePlan.values)]),
    ]), [body, normalizedHeaders, url, variablePlan.values, variablePlan.warnings])
    const headerPlan = useMemo(() => normalizeRequestHeaders(resolvedHeaders), [resolvedHeaders])
    const activeRun = useMemo(() => runs.find((run) => run.id === activeRunId) || runs[0] || null, [activeRunId, runs])
    const response = activeRun?.response ?? null
    const hasRunningRequests = runs.some((run) => run.loading)
    const previewUrl = getImagePreviewUrl(response, activeRun?.url || url)
    const executionMode = share?.alias ? 'Share VM' : getCookie('access_token') ? 'Workspace API' : 'Browser mode'

    const send = useCallback(async (e?: SyntheticEvent) => {
        e?.preventDefault()
        const token = getCookie('access_token'); const id = getCookie('id'); const runId = randomId()
        const request = { method, url: resolvedUrl, headers: headerPlan.headers, body: resolvedBody }
        const startedAt = new Date().toISOString()
        setRuns((current) => [{ id: runId, method, url: resolvedUrl, startedAt, loading: true, response: null }, ...current].slice(0, 8))
        setActiveRunId(runId); setResponseTab('response')
        try {
            let data: ToolResponse
            if (share?.alias) data = await sendViaShareVm({ shareAlias: share.alias, method, url: resolvedUrl, headers: headerPlan.headers, body: resolvedBody })
            else if (token && id) data = await sendViaWorkspaceApi(request, id, token)
            else data = await sendFromBrowser(request)
            const enriched = sanitizeToolResponse(withRequestDetails({ ...data, warnings: uniqueWarnings([...templateWarnings, ...headerPlan.warnings, ...(data.warnings || [])]) }, request))
            setRuns((current) => current.map((run) => run.id === runId ? { ...run, loading: false, response: enriched } : run))
            onRequestComplete({ id: selectedRequestId ?? runId, method, url, headers: headerRowsFromObject(headerPlan.headers), body, createdAt: new Date().toISOString(), status: enriched.status, statusText: enriched.statusText, elapsedMs: enriched.elapsed_ms, error: enriched.error, requestSource: share?.alias ? 'vm' : 'browser' })
        } catch (error) {
            const enriched = sanitizeToolResponse(withRequestDetails({ error: error instanceof Error ? error.message : String(error), warnings: templateWarnings }, request))
            setRuns((current) => current.map((run) => run.id === runId ? { ...run, loading: false, response: enriched } : run))
        }
    }, [body, headerPlan, method, onRequestComplete, resolvedBody, resolvedUrl, selectedRequestId, share?.alias, templateWarnings, url])
    useEffect(() => { if (runToken !== lastRunTokenRef.current) { lastRunTokenRef.current = runToken; void send() } }, [runToken, send])

    const askAi = async () => {
        const token = getCookie('access_token'); const id = getCookie('id')
        if (!token || !id) return setAiResponse('Login required.')
        setAiLoading(true); setAiResponse('')
        try {
            const context = { activeRequest: { method, url, resolvedUrl, headers: headerPlan.headers, body: resolvedBody, variables: normalizedVariables.filter((row) => row.key && row.value), warnings: uniqueWarnings([...templateWarnings, ...headerPlan.warnings]) }, response: response ?? null, recentRuns: runs.slice(0, 4).map((run) => ({ method: run.method, url: run.url, loading: run.loading, status: run.response?.status, statusText: run.response?.statusText, error: run.response?.error, warnings: run.response?.warnings })) }
            const result = await fetch(`${config.url.api}/tools/ai`, { method: 'POST', headers: { 'Content-Type': 'application/json', id, Authorization: `Bearer ${token}` }, body: JSON.stringify({ prompt: [aiPrompt, 'Use the request context below. Explain what happened in plain language, suggest the next request or UI action, and call out likely tool issues separately from target-service issues.'].join('\n\n'), context: JSON.stringify(context, null, 2), maxTokens: 1200 }) })
            const data = await result.json().catch(() => ({}))
            setAiResponse(redactSensitiveText(data.message || data.suggestion || data.error || 'No AI response.'))
        } catch (error) { setAiResponse(error instanceof Error ? error.message : String(error)) }
        finally { setAiLoading(false) }
    }

    const handleUrlPaste = (event: ClipboardEvent<HTMLInputElement>) => {
        const parsed = parseCurlCommand(event.clipboardData.getData('text'))
        if (!parsed) return
        event.preventDefault(); setMethod(parsed.method); setUrl(parsed.url); setHeaders(parsed.headers); setBody(parsed.body)
        setTab(parsed.headers.some((header) => header.key || header.value) ? 'headers' : parsed.body ? 'body' : 'headers')
    }
    const updateVariable = (index: number, field: keyof VariableRow, value: string) => setVariables((prev) => {
        const next = normalizeVariableRows(prev).map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row)
        saveScopedRequestVariables(next, share?.alias || share?.id || null); return next
    })
    const setAndSaveVariables = (next: VariableRow[]) => { const normalized = normalizeVariableRows(next); saveScopedRequestVariables(normalized, share?.alias || share?.id || null); setVariables(normalized) }

    return <div className='grid h-full min-h-0 gap-2 overflow-auto pr-1'>
        <RequestControls method={method} url={url} resolvedUrl={resolvedUrl} tab={tab} hasRunningRequests={hasRunningRequests} executionMode={executionMode} inputRef={inputRef} onMethodChange={setMethod} onUrlChange={setUrl} onUrlPaste={handleUrlPaste} onTabChange={setTab} onSubmit={send} />
        <ResponsePanel response={response} activeRun={activeRun} executionMode={executionMode} responseTab={responseTab} previewUrl={previewUrl} treeFilter={treeFilter} headerFilter={headerFilter} onResponseTabChange={setResponseTab} onTreeFilterChange={setTreeFilter} onHeaderFilterChange={setHeaderFilter} />
        <RequestEditor tab={tab} headers={normalizedHeaders} variables={normalizedVariables} body={body} aiPrompt={aiPrompt} aiResponse={aiResponse} aiLoading={aiLoading} templateWarnings={templateWarnings} headerWarnings={headerPlan.warnings}
            onHeaderChange={(index, field, value) => setHeaders((prev) => normalizeHeaderRows(prev).map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row))}
            onHeaderDelete={(index) => setHeaders((prev) => normalizeHeaderRows(prev).length === 1 ? [{ key: '', value: '' }] : normalizeHeaderRows(prev).filter((_, rowIndex) => rowIndex !== index))}
            onHeaderAdd={() => setHeaders((prev) => [...normalizeHeaderRows(prev), { key: '', value: '' }])} onBodyChange={setBody}
            onVariableChange={updateVariable} onVariableDelete={(index) => setAndSaveVariables(normalizedVariables.length === 1 ? [{ key: '', value: '' }] : normalizedVariables.filter((_, rowIndex) => rowIndex !== index))}
            onVariableAdd={() => setAndSaveVariables([...normalizedVariables, { key: '', value: '' }])} onAiPromptChange={setAiPrompt} onAskAi={askAi} />
        <RequestRunHistory runs={runs} activeRun={activeRun} onSelect={setActiveRunId} />
    </div>
}
