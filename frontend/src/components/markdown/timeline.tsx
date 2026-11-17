import { useState } from 'react'
import type { CSSProperties } from 'react'
import { ImagePlus, Plus, Trash2 } from 'lucide-react'
import styles from './timeline.module.css'

export type TimelineItem = { image: string, title: string, text: string }

export function parseTimeline(source: string): TimelineItem[] | null {
    try {
        const value: unknown = JSON.parse(source)
        if (!Array.isArray(value) || value.length > 50) return null
        if (!value.every(item => item && typeof item === 'object' && typeof item.image === 'string'
            && typeof item.title === 'string' && typeof item.text === 'string'
            && item.image.length <= 2000 && item.title.length <= 200 && item.text.length <= 2000)) return null
        return value as TimelineItem[]
    } catch { return null }
}

export function timelineBlock(items: TimelineItem[]) {
    return `\n\n\`\`\`timeline\n${JSON.stringify(items, null, 2)}\n\`\`\`\n\n`
}

export default function Timeline({ items, onChange, uploadImage }: { items: TimelineItem[], onChange?: (items: TimelineItem[]) => void, uploadImage?: (file: File) => Promise<string> }) {
    const [editing, setEditing] = useState<number | null>(null)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')
    const editable = Boolean(onChange)
    const update = (index: number, patch: Partial<TimelineItem>) => onChange?.(items.map((item, position) => position === index ? { ...item, ...patch } : item))
    const insert = (index: number) => { onChange?.([...items.slice(0, index), { image: '', title: '', text: '' }, ...items.slice(index)]); setEditing(index) }
    async function upload(file: File, index: number) {
        if (!uploadImage) return
        setUploading(true); setError('')
        try { update(index, { image: await uploadImage(file) }) }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Image upload failed.') }
        finally { setUploading(false) }
    }
    if (!items.length) return editable ? <button type='button' className={styles.empty} onClick={() => insert(0)}><Plus size={18} /> Add first turn</button> : null
    const height = items.length * 280
    const x = (index: number) => index % 2 ? 74 : 26
    const path = items.map((_, index) => index === 0 ? `M ${x(index)} 140` : `C ${x(index - 1)} ${index * 280 - 10}, ${x(index)} ${index * 280 + 10}, ${x(index)} ${index * 280 + 140}`).join(' ')
    return <div className={styles.timeline} style={{ '--turns': items.length } as CSSProperties} aria-label='Timeline'>
        <svg className={styles.path} viewBox={`0 0 100 ${height}`} preserveAspectRatio='none' aria-hidden='true'>
            <path d={path} fill='none' stroke='currentColor' strokeWidth='0.55' vectorEffect='non-scaling-stroke' />
        </svg>
        {items.map((item, index) => <article className={`${styles.turn} ${index % 2 ? styles.right : styles.left}`} key={index}>
            {editable && index === 0 && <button type='button' className={`${styles.insert} ${styles.insertTop}`} onClick={() => insert(0)} aria-label='Add turn at top' title='Add turn at top'><Plus size={18} /></button>}
            <span className={styles.marker} aria-hidden='true' />
            <div className={`${styles.card} ${editable ? styles.editable : ''}`} onClick={() => { if (editable) setEditing(index) }}>
                {editable && <button type='button' className={styles.remove} onClick={event => { event.stopPropagation(); onChange?.(items.filter((_, position) => position !== index)); setEditing(null) }} aria-label={`Remove turn ${index + 1}`} title='Remove turn'><Trash2 size={16} /></button>}
                {editing === index && editable ? <>
                    {item.image && <img src={item.image} alt='' loading='lazy' />}
                    <label className={styles.upload}><ImagePlus size={16} /> {uploading ? 'Uploading…' : item.image ? 'Replace image' : 'Add image'}<input type='file' accept='image/png,image/jpeg,image/webp,image/gif' disabled={uploading} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file, index); event.target.value = '' }} /></label>
                    <input autoFocus aria-label={`Turn ${index + 1} title`} value={item.title} onChange={event => update(index, { title: event.target.value })} maxLength={200} placeholder='Title' className={styles.titleInput} />
                    <textarea aria-label={`Turn ${index + 1} subtext`} value={item.text} onChange={event => update(index, { text: event.target.value })} maxLength={2000} placeholder='Text' rows={Math.max(3, Math.ceil(item.text.length / 45))} className={styles.textInput} />
                    {error && <p role='alert'>{error}</p>}
                </> : <>
                    {item.image && <img src={item.image} alt='' loading='lazy' />}
                    <h3>{item.title || (editable ? 'Click to add a title' : `Turn ${index + 1}`)}</h3>
                    {item.text && <p>{item.text}</p>}
                </>}
            </div>
            {editable && <button type='button' className={`${styles.insert} ${styles.insertAfter}`} onClick={() => insert(index + 1)} aria-label={index === items.length - 1 ? 'Add turn at end' : `Add turn between ${index + 1} and ${index + 2}`} title='Add turn'><Plus size={18} /></button>}
        </article>)}
    </div>
}
