'use client'

import { useRef, useState } from 'react'
import MarkdownDocument from './MarkdownDocument'
import { parseTimeline, timelineBlock, type TimelineItem } from './timeline'

const blocks = /```timeline\s*\n([\s\S]*?)\n```/g

export default function MarkdownDocumentEditor({ value, onChange, uploadImage, disabled = false }: {
    value: string, onChange: (value: string) => void,
    uploadImage: (file: File) => Promise<string>, disabled?: boolean,
}) {
    const input = useRef<HTMLTextAreaElement>(null)
    const valueRef = useRef(value)
    valueRef.current = value
    const fileInput = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')
    const timelines = [...value.matchAll(blocks)].map(match => ({ match, items: parseTimeline(match[1]) })).filter(entry => entry.items !== null)

    function setValue(next: string) { valueRef.current = next; onChange(next) }

    function currentTimelines() {
        return [...valueRef.current.matchAll(blocks)].map(match => ({ match, items: parseTimeline(match[1]) })).filter(entry => entry.items !== null)
    }

    function insert(markdown: string) {
        const target = input.current
        const current = valueRef.current
        const start = target?.selectionStart ?? current.length
        const end = target?.selectionEnd ?? current.length
        setValue(current.slice(0, start) + markdown + current.slice(end))
        requestAnimationFrame(() => { target?.focus(); target?.setSelectionRange(start + markdown.length, start + markdown.length) })
    }

    function updateTimeline(index: number, items: TimelineItem[]) {
        const current = valueRef.current
        const match = currentTimelines()[index]?.match
        if (!match || match.index === undefined) return
        setValue(current.slice(0, match.index) + timelineBlock(items).trim() + current.slice(match.index + match[0].length))
    }

    async function upload(file: File, index?: number, itemIndex?: number) {
        setError(''); setUploading(true)
        try {
            const url = await uploadImage(file)
            if (index !== undefined && itemIndex !== undefined) {
                const items = currentTimelines()[index]?.items
                if (items) updateTimeline(index, items.map((item, position) => position === itemIndex ? { ...item, image: url } : item))
            } else insert(`![${file.name.replaceAll('[', '').replaceAll(']', '')}](${url})`)
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'Image upload failed.') }
        finally { setUploading(false) }
    }

    return <div className='grid gap-5'>
        <div className='flex flex-wrap gap-2'>
            <button type='button' disabled={disabled} onClick={() => insert('\n\n## Heading\n\n')} className='rounded border border-ui-border px-3 py-2'>Heading</button>
            <button type='button' disabled={disabled || uploading} onClick={() => fileInput.current?.click()} className='rounded border border-ui-border px-3 py-2'>Add image</button>
            <button type='button' disabled={disabled} onClick={() => insert(timelineBlock([{ image: '', title: 'First turn', text: '' }]))} className='rounded border border-ui-border px-3 py-2'>Add curved timeline</button>
            <input ref={fileInput} type='file' accept='image/png,image/jpeg,image/webp,image/gif' className='sr-only' onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = '' }} />
        </div>
        {error && <p role='alert' className='text-red-600'>{error}</p>}
        <div className='grid gap-5 lg:grid-cols-2'>
            <label className='grid gap-2 text-sm font-semibold'>Markdown
                <textarea ref={input} value={value} disabled={disabled} onChange={event => setValue(event.target.value)} rows={20} spellCheck className='w-full resize-y rounded-lg border border-ui-border bg-ui-panel p-4 font-mono text-sm font-normal text-ui-text' placeholder='Write your page here…' />
            </label>
            <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-4' aria-label='Live page preview'><MarkdownDocument text={value} /></div>
        </div>
        {timelines.map(({ items }, index) => <section key={index} className='grid gap-3 rounded-lg border border-ui-border p-4' aria-label={`Timeline ${index + 1} editor`}>
            <h2 className='font-semibold'>Timeline {index + 1}</h2>
            {items?.map((item, itemIndex) => <div key={itemIndex} className='grid gap-2 rounded border border-ui-border p-3 md:grid-cols-[1fr_1fr_auto]'>
                <input aria-label={`Turn ${itemIndex + 1} title`} value={item.title} disabled={disabled} onChange={event => updateTimeline(index, items.map((entry, position) => position === itemIndex ? { ...entry, title: event.target.value } : entry))} className='rounded border border-ui-border bg-ui-panel p-2' placeholder='Title' />
                <textarea aria-label={`Turn ${itemIndex + 1} subtext`} value={item.text} disabled={disabled} onChange={event => updateTimeline(index, items.map((entry, position) => position === itemIndex ? { ...entry, text: event.target.value } : entry))} className='rounded border border-ui-border bg-ui-panel p-2' placeholder='Subtext' />
                <div className='flex flex-col gap-2'>
                    <label className='cursor-pointer rounded border border-ui-border px-2 py-1 text-center'>Image<input type='file' accept='image/png,image/jpeg,image/webp,image/gif' disabled={disabled || uploading} className='sr-only' onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file, index, itemIndex); event.target.value = '' }} /></label>
                    <button type='button' disabled={disabled} onClick={() => updateTimeline(index, items.filter((_, position) => position !== itemIndex))} className='rounded border border-ui-border px-2 py-1'>Remove</button>
                </div>
                {item.image && <img src={item.image} alt='' className='h-16 w-24 object-cover' />}
            </div>)}
            <button type='button' disabled={disabled} onClick={() => updateTimeline(index, [...(items || []), { image: '', title: '', text: '' }])} className='w-fit rounded border border-ui-border px-3 py-2'>Add turn</button>
        </section>)}
    </div>
}
