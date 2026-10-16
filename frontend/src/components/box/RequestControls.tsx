import { ChevronDown, Play, Server } from 'lucide-react'
import type { ClipboardEvent, FormEvent, RefObject } from 'react'
import type { RequestEditorTab } from './newRequestTypes'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

type RequestControlsProps = {
    method: string
    url: string
    resolvedUrl: string
    tab: RequestEditorTab
    hasRunningRequests: boolean
    executionMode: string
    inputRef: RefObject<HTMLInputElement | null>
    onMethodChange: (value: string) => void
    onUrlChange: (value: string) => void
    onUrlPaste: (event: ClipboardEvent<HTMLInputElement>) => void
    onTabChange: (tab: RequestEditorTab) => void
    onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export default function RequestControls(props: RequestControlsProps) {
    const { method, url, resolvedUrl, tab, hasRunningRequests, executionMode, inputRef } = props
    return (
        <form onSubmit={props.onSubmit} className='grid gap-2 rounded-lg border border-ui-border bg-ui-canvas/12 p-2'>
            <div className='grid gap-2 sm:grid-cols-[86px_minmax(0,1fr)_74px]'>
                <label className='relative min-w-0'>
                    <span className='sr-only'>Method</span>
                    <select value={method} onChange={(e) => props.onMethodChange(e.target.value)} className='h-10 w-full cursor-pointer appearance-none rounded-full border border-ui-border bg-ui-panel/[0.045] px-3 pr-8 text-xs font-semibold text-ui-text outline-none focus:border-ui-warning/45'>
                        {METHODS.map((item) => <option key={item} value={item} className='bg-background'>{item}</option>)}
                    </select>
                    <ChevronDown className='pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ui-text/45' />
                </label>
                <input ref={inputRef} className='h-10 min-w-0 rounded-full border border-ui-border bg-ui-panel/[0.045] px-3 text-sm text-ui-text outline-none focus:border-ui-warning/45' placeholder='https://api.example.com/v1/users' value={url} onChange={(e) => props.onUrlChange(e.target.value)} onPaste={props.onUrlPaste} required />
                <button type='submit' className='flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-ui-warning px-3 text-[11px] font-semibold text-background hover:bg-ui-warning'>
                    <Play className='h-3.5 w-3.5' />{' '}Run
                </button>
            </div>
            <div className='min-w-0 rounded-lg border border-ui-border bg-ui-canvas/18 px-3 py-2 font-mono text-[11px] leading-4 text-ui-text/62'>
                <span className='mr-2 text-ui-text/32'>URL</span><span className='mr-2 text-ui-text/45'>{method}</span>
                <span className='break-all' title={resolvedUrl}>{resolvedUrl || 'Enter a request URL.'}</span>
                {resolvedUrl !== url ? <span className='mt-1 block text-ui-text/35' title={url}>Template: {url}</span> : null}
            </div>
            <div className='flex flex-wrap items-center justify-between gap-2 px-1'>
                <div className='flex flex-wrap gap-2 text-xs font-medium text-ui-text/70'>
                    {(['headers', 'body', 'vars', 'ai'] as const).map((item) => (
                        <button key={item} type='button' onClick={() => props.onTabChange(item)} className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] capitalize ${tab === item ? 'bg-ui-panel/12 text-ui-text' : 'text-ui-text/50 hover:bg-ui-panel/7 hover:text-ui-text/75'}`}>
                            {item === 'ai' ? 'AI' : item === 'vars' ? 'Vars' : item}
                        </button>
                    ))}
                </div>
                <div className='inline-flex items-center gap-2 rounded-full border border-ui-border px-3 py-1 text-[11px] text-ui-text/55'>
                    <Server className='h-3.5 w-3.5' />{hasRunningRequests ? 'Running requests' : executionMode}
                </div>
            </div>
        </form>
    )
}
