import { Clock3, ImageIcon, Search } from 'lucide-react'
import { formatHeaders, formatRequestLine } from '@/utils/box/requestTool'
import { formatCurlCommand, formatHttpRequest } from './requestExport'
import { formatFilteredHeaders, formatJsonTree, formatPrettyResponseBody, formatRawResponseBody } from './responseFormatting'
import type { RequestRun, ResponseTab } from './newRequestTypes'
import type { ToolResponse } from './types'

type ResponsePanelProps = {
    response: ToolResponse | null
    activeRun: RequestRun | null
    executionMode: string
    responseTab: ResponseTab
    previewUrl: string | null
    treeFilter: string
    headerFilter: string
    onResponseTabChange: (tab: ResponseTab) => void
    onTreeFilterChange: (value: string) => void
    onHeaderFilterChange: (value: string) => void
}

const RESPONSE_TABS: ResponseTab[] = ['response', 'raw', 'tree', 'preview', 'headers', 'request', 'curl', 'http']

export default function ResponsePanel(props: ResponsePanelProps) {
    const { response, activeRun, executionMode, responseTab, previewUrl, treeFilter, headerFilter } = props
    const responseStatus = activeRun?.loading ? 'Running' : response?.status ? `${response.status} ${response.statusText || ''}`.trim() : response?.error ? 'Error' : 'Not sent'
    const runningMessage = 'Request is running...'
    return (
        <section className='grid min-h-0 gap-2 rounded-lg border border-ui-border bg-ui-canvas/12 p-2'>
            <div className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-ui-border bg-ui-canvas/16 px-3 py-2 text-[11px] text-ui-text/50'>
                <span className='inline-flex min-w-0 items-center gap-1.5'><span>Status</span><strong className={`truncate font-semibold ${response?.ok ? 'text-ui-success' : response?.error ? 'text-ui-text' : 'text-ui-text/82'}`}>{responseStatus}</strong></span>
                <span className='inline-flex min-w-0 items-center gap-1.5'><span>Source</span><strong className='truncate font-semibold text-ui-text/82'>{executionMode}</strong></span>
                <span className='inline-flex min-w-0 items-center gap-1.5'><Clock3 className='h-3 w-3 text-ui-text/35' /><strong className='truncate font-semibold text-ui-text/82'>{response?.elapsed_ms !== undefined ? `${response.elapsed_ms} ms` : activeRun?.loading ? 'Running' : 'Pending'}</strong></span>
            </div>
            <div className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
                <div className='flex flex-wrap gap-2 text-xs font-medium text-ui-text/70'>
                    {RESPONSE_TABS.map((item) => <button key={item} type='button' onClick={() => props.onResponseTabChange(item)} className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] capitalize ${responseTab === item ? 'bg-ui-panel/12 text-ui-text' : 'text-ui-text/50 hover:bg-ui-panel/7 hover:text-ui-text/75'}`}>
                        {item === 'response' ? 'Pretty' : item === 'preview' ? <span className='inline-flex items-center gap-1'><ImageIcon className='h-3 w-3' />{' '}Preview</span> : item === 'curl' ? 'cURL' : item === 'http' ? 'HTTP' : item}
                    </button>)}
                </div>
                {response?.warnings?.length ? <span className='max-w-full truncate rounded-full bg-ui-warning/10 px-2.5 py-1 text-[11px] text-ui-warning/72' title={response.warnings.join('\n')}>{response.warnings.length} warning{response.warnings.length === 1 ? '' : 's'}</span> : null}
            </div>
            <div className='grid min-h-44 overflow-hidden rounded-lg bg-ui-canvas/22'>
                {responseTab === 'response' && <pre className='min-h-32 overflow-auto whitespace-pre-wrap wrap-break-word p-4 text-xs leading-5 text-ui-text/80'>{activeRun?.loading ? runningMessage : response ? formatPrettyResponseBody(response) : 'Run a request to stream the formatted response.'}</pre>}
                {responseTab === 'raw' && <pre className='min-h-32 overflow-auto whitespace-pre-wrap wrap-break-word p-4 text-xs leading-5 text-ui-text/80'>{activeRun?.loading ? runningMessage : response ? formatRawResponseBody(response) : 'Run a request to stream the raw response.'}</pre>}
                {responseTab === 'tree' && <div className='grid min-h-32 grid-rows-[auto_minmax(0,1fr)] overflow-hidden'>
                    <label className='flex h-10 items-center gap-2 border-b border-ui-border px-3 text-ui-text/45'><Search className='h-3.5 w-3.5 shrink-0' /><span className='sr-only'>Filter JSON paths</span><input value={treeFilter} onChange={(event) => props.onTreeFilterChange(event.target.value)} placeholder='Filter paths or values' className='min-w-0 flex-1 bg-transparent text-xs text-ui-text/78 outline-none placeholder:text-ui-text/32' /></label>
                    <pre className='min-h-0 overflow-auto whitespace-pre-wrap wrap-break-word p-4 text-xs leading-5 text-ui-text/80'>{activeRun?.loading ? runningMessage : response ? formatJsonTree(response, treeFilter) : 'Run a request to inspect JSON paths.'}</pre>
                </div>}
                {responseTab === 'preview' && <div className='grid min-h-32 place-items-center overflow-auto p-4 text-xs text-ui-text/55'>{previewUrl ? <img src={previewUrl} alt='Response preview' className='max-h-64 max-w-full rounded-lg object-contain' /> : 'Image previews appear for image URLs or image responses.'}</div>}
                {responseTab === 'headers' && <div className='grid min-h-32 grid-rows-[auto_minmax(0,1fr)] overflow-hidden'>
                    <label className='flex h-10 items-center gap-2 border-b border-ui-border px-3 text-ui-text/45'><Search className='h-3.5 w-3.5 shrink-0' /><span className='sr-only'>Filter response headers</span><input value={headerFilter} onChange={(event) => props.onHeaderFilterChange(event.target.value)} placeholder='Filter response headers' className='min-w-0 flex-1 bg-transparent text-xs text-ui-text/78 outline-none placeholder:text-ui-text/32' /></label>
                    <pre className='min-h-0 overflow-auto whitespace-pre-wrap wrap-break-word p-4 text-xs leading-5 text-ui-text/75'>{response?.headers ? formatFilteredHeaders(response.headers, headerFilter) : 'Run a request to inspect response headers.'}</pre>
                </div>}
                {responseTab === 'request' && <div className='grid min-h-32 gap-3 overflow-auto p-4 text-xs text-ui-text/80'>
                    <RequestDetail label='Request line'>{formatRequestLine(response?.request)}</RequestDetail>
                    <RequestDetail label='Request headers'>{formatHeaders(response?.request?.headers)}</RequestDetail>
                    <RequestDetail label='Request body'>{response?.request?.body || 'No request body.'}</RequestDetail>
                </div>}
                {responseTab === 'curl' && <pre className='min-h-32 overflow-auto whitespace-pre-wrap wrap-break-word p-4 text-xs leading-5 text-ui-text/78'>{response?.request ? formatCurlCommand(response.request) : 'Run a request to generate a cURL command.'}</pre>}
                {responseTab === 'http' && <pre className='min-h-32 overflow-auto whitespace-pre-wrap wrap-break-word p-4 text-xs leading-5 text-ui-text/78'>{response?.request ? formatHttpRequest(response.request) : 'Run a request to generate a .http request.'}</pre>}
            </div>
        </section>
    )
}

function RequestDetail({ label, children }: { label: string; children: string }) {
    return <div className='grid gap-1'><span className='text-[11px] uppercase tracking-[0.24em] text-ui-text/40'>{label}</span><pre className='whitespace-pre-wrap wrap-break-word rounded-lg bg-ui-panel/5 p-3'>{children}</pre></div>
}
