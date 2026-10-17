import { Bot } from 'lucide-react'
import type { HeaderRow, VariableRow } from './types'
import type { RequestEditorTab } from './newRequestTypes'
import { uniqueWarnings } from './requestPresentation'
import KeyValueRowsEditor from './KeyValueRowsEditor'

type RequestEditorProps = {
    tab: RequestEditorTab
    headers: HeaderRow[]
    variables: VariableRow[]
    body: string
    aiPrompt: string
    aiResponse: string
    aiLoading: boolean
    templateWarnings: string[]
    headerWarnings: string[]
    onHeaderChange: (index: number, field: keyof HeaderRow, value: string) => void
    onHeaderDelete: (index: number) => void
    onHeaderAdd: () => void
    onBodyChange: (value: string) => void
    onVariableChange: (index: number, field: keyof VariableRow, value: string) => void
    onVariableDelete: (index: number) => void
    onVariableAdd: () => void
    onAiPromptChange: (value: string) => void
    onAskAi: () => void
}

export default function RequestEditor(props: RequestEditorProps) {
    const { tab, headers, variables, body, aiPrompt, aiResponse, aiLoading } = props
    return (
        <section className='grid min-h-0 gap-2 rounded-lg border border-ui-border bg-ui-canvas/12 p-2'>
            {tab === 'headers' && <div className='grid min-h-0 content-start gap-2'>
                <KeyValueRowsEditor rows={headers} keyPlaceholder='Header' valuePlaceholder='Value' addLabel='Add header' itemLabel='header' onChange={props.onHeaderChange} onDelete={props.onHeaderDelete} onAdd={props.onHeaderAdd} />
                {props.templateWarnings.length || props.headerWarnings.length ? <div className='rounded-lg border border-ui-warning/12 bg-ui-warning/8 px-3 py-2 text-[11px] leading-4 text-ui-warning/72'>{uniqueWarnings([...props.templateWarnings, ...props.headerWarnings]).join(' ')}</div> : null}
            </div>}
            {tab === 'body' && <textarea value={body} onChange={(e) => props.onBodyChange(e.target.value)} placeholder='JSON, text or form body' className='min-h-32 rounded-lg border border-ui-border bg-ui-panel/[0.025] p-3 font-mono text-sm text-ui-text outline-none' />}
            {tab === 'vars' && <div className='grid min-h-0 content-start gap-2'>
                <KeyValueRowsEditor rows={variables} keyPlaceholder='baseUrl' valuePlaceholder='https://api.example.com' addLabel='Add variable' itemLabel='variable' onChange={props.onVariableChange} onDelete={props.onVariableDelete} onAdd={props.onVariableAdd} />
                <div className='rounded-lg border border-ui-border bg-ui-canvas/14 px-3 py-2 text-[11px] leading-4 text-ui-text/48'>Use variables as {'{{baseUrl}}'} in URLs, headers, and bodies. They stay scoped to this share.</div>
            </div>}
            {tab === 'ai' && <div className='grid min-h-0 gap-3 lg:grid-rows-[auto_auto_minmax(0,1fr)]'>
                <textarea value={aiPrompt} onChange={(e) => props.onAiPromptChange(e.target.value)} className='min-h-24 rounded-lg border border-ui-border bg-ui-panel/[0.025] p-3 text-sm text-ui-text outline-none' />
                <button type='button' onClick={props.onAskAi} disabled={aiLoading} className='flex w-fit cursor-pointer items-center gap-2 rounded-full bg-ui-primary/12 px-3 py-1.5 text-[11px] font-semibold text-ui-primary hover:bg-ui-primary/20 disabled:cursor-not-allowed disabled:opacity-60'><Bot className='h-3.5 w-3.5' />{' '}{aiLoading ? 'Asking...' : 'Ask AI'}</button>
                <pre className='max-h-32 min-h-0 overflow-auto whitespace-pre-wrap wrap-break-word rounded-lg bg-ui-canvas/20 p-3 text-sm text-ui-text/70'>{aiLoading ? 'Thinking through the request and response...' : aiResponse || 'Run analysis to review this request.'}</pre>
            </div>}
        </section>
    )
}
