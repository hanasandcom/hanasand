'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Plus } from 'lucide-react'
import MarkdownDocument from './MarkdownDocument'
import Timeline, { parseTimeline, timelineBlock, type TimelineItem } from './timeline'

type Section = { kind: 'text', start: number, end: number, text: string } | { kind: 'timeline', start: number, end: number, items: TimelineItem[] }

export function documentSections(value: string): Section[] {
    const sections: Section[] = []
    const pattern = /```timeline\s*\n([\s\S]*?)\n```/g
    let cursor = 0
    for (const match of value.matchAll(pattern)) {
        if (match.index > cursor) sections.push({ kind: 'text', start: cursor, end: match.index, text: value.slice(cursor, match.index) })
        const items = parseTimeline(match[1])
        if (items) sections.push({ kind: 'timeline', start: match.index, end: match.index + match[0].length, items })
        else sections.push({ kind: 'text', start: match.index, end: match.index + match[0].length, text: match[0] })
        cursor = match.index + match[0].length
    }
    if (cursor < value.length || !sections.length) sections.push({ kind: 'text', start: cursor, end: value.length, text: value.slice(cursor) })
    return sections
}

export default function InlineMarkdownDocumentEditor({ value, onChange, uploadImage, disabled = false }: {
    value: string, onChange: (value: string) => void,
    uploadImage: (file: File) => Promise<string>, disabled?: boolean,
}) {
    const valueRef = useRef(value)
    valueRef.current = value
    const [editing, setEditing] = useState<number | null>(null)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')
    const sections = documentSections(value).filter(section => section.kind === 'timeline' || section.text.trim() || !value.trim())

    function replace(section: Section, next: string) {
        const current = valueRef.current
        valueRef.current = current.slice(0, section.start) + next + current.slice(section.end)
        onChange(valueRef.current)
    }

    function append(kind: 'text' | 'timeline') {
        const current = valueRef.current
        const extra = kind === 'timeline' ? timelineBlock([{ image: '', title: '', text: '' }]) : '\n\nWrite here…\n\n'
        valueRef.current = current + extra
        onChange(valueRef.current)
        if (kind === 'text') setEditing(documentSections(valueRef.current).filter(section => section.kind === 'timeline' || section.text.trim()).length - 1)
    }

    async function addImage(file: File, section: Section) {
        setUploading(true); setError('')
        try {
            const url = await uploadImage(file)
            replace(section, `${section.kind === 'text' ? section.text : ''}\n\n![${file.name.replaceAll('[', '').replaceAll(']', '')}](${url})\n\n`)
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'Image upload failed.') }
        finally { setUploading(false) }
    }

    return <div className='grid gap-4'>
        {sections.map((section, index) => section.kind === 'timeline'
            ? <Timeline key={`${section.start}-timeline`} items={section.items} onChange={disabled ? undefined : items => replace(section, timelineBlock(items).trim())} uploadImage={uploadImage} />
            : <div key={`${section.start}-text`} className='group min-w-0'>
                {editing === index && !disabled ? <div className='rounded-lg border border-ui-border bg-ui-panel p-3'>
                    <textarea autoFocus aria-label='Page text' value={section.text} onChange={event => replace(section, event.target.value)} rows={Math.max(5, section.text.split('\n').length + 2)} className='w-full resize-y bg-transparent p-2 text-ui-text outline-none' placeholder='Write Markdown here…' />
                    <div className='flex items-center justify-between'>
                        <label className='cursor-pointer rounded p-2 text-ui-secondary hover:bg-ui-canvas' title='Insert image'><ImagePlus size={18} /><input type='file' accept='image/png,image/jpeg,image/webp,image/gif' disabled={uploading} className='sr-only' onChange={event => { const file = event.target.files?.[0]; if (file) void addImage(file, section); event.target.value = '' }} /></label>
                        <button type='button' className='rounded px-3 py-1 text-sm text-ui-secondary hover:bg-ui-canvas' onClick={() => setEditing(null)}>Done</button>
                    </div>
                </div> : <div className={`${disabled ? '' : 'min-h-8 cursor-text rounded-lg p-2 hover:bg-ui-panel'}`} onClick={() => { if (!disabled) setEditing(index) }}>
                    {section.text.trim() ? <MarkdownDocument text={section.text} /> : !disabled ? <span className='text-ui-muted'>Click to write text…</span> : null}
                </div>}
            </div>)}
        {error && <p role='alert' className='text-red-600'>{error}</p>}
        {!disabled && <div className='flex gap-2 border-t border-ui-border pt-4'>
            <button type='button' onClick={() => append('text')} className='inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm text-ui-secondary hover:bg-ui-panel'><Plus size={16} /> Text</button>
            <button type='button' onClick={() => append('timeline')} className='inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm text-ui-secondary hover:bg-ui-panel'><Plus size={16} /> Timeline</button>
        </div>}
    </div>
}
