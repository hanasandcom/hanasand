import type { CSSProperties } from 'react'
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

export default function Timeline({ items }: { items: TimelineItem[] }) {
    if (!items.length) return <p className={styles.empty}>Add a turn to this timeline.</p>
    const height = items.length * 280
    const x = (index: number) => index % 2 ? 74 : 26
    const path = items.map((_, index) => index === 0 ? `M ${x(index)} 140` : `C ${x(index - 1)} ${index * 280 - 10}, ${x(index)} ${index * 280 + 10}, ${x(index)} ${index * 280 + 140}`).join(' ')
    return <div className={styles.timeline} style={{ '--turns': items.length } as CSSProperties} aria-label='Timeline'>
        <svg className={styles.path} viewBox={`0 0 100 ${height}`} preserveAspectRatio='none' aria-hidden='true'>
            <path d={path} fill='none' stroke='currentColor' strokeWidth='0.55' vectorEffect='non-scaling-stroke' />
        </svg>
        {items.map((item, index) => <article className={`${styles.turn} ${index % 2 ? styles.right : styles.left}`} key={index}>
            <span className={styles.marker} aria-hidden='true' />
            <div className={styles.card}>
                {item.image && <img src={item.image} alt='' loading='lazy' />}
                <h3>{item.title || `Turn ${index + 1}`}</h3>
                {item.text && <p>{item.text}</p>}
            </div>
        </article>)}
    </div>
}
