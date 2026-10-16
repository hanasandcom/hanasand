import Link from 'next/link'
import { FileText, ShieldCheck } from 'lucide-react'
import { ActorMark } from '@/components/ti/actorMark'
import type { SearchGroup } from './types'

type Props = SearchGroup & {
    onSelect: () => void
    onSelectIndex: (index: number) => void
    selectedIndex: number
    startIndex: number
}

export default function ResultGroup({
    title,
    items,
    icon,
    onSelect,
    onSelectIndex,
    selectedIndex,
    startIndex,
}: Props) {
    if (!items.length) return null
    return (
        <section role='group' aria-label={title} className='mb-3 last:mb-0'>
            <p className='px-2 pb-1 text-[10px] font-semibold uppercase text-ui-muted'>{title}</p>
            <div className='grid gap-1'>
                {items.map((item, index) => {
                    const selected = startIndex + index === selectedIndex
                    return (
                        <Link
                            key={item.id}
                            id={`site-search-result-${item.id}`}
                            role='option'
                            aria-selected={selected}
                            href={item.href}
                            onClick={onSelect}
                            onMouseEnter={() => onSelectIndex(startIndex + index)}
                            className={`grid grid-cols-[2.25rem_1fr] gap-3 rounded-lg border px-2 py-2 transition ${selected ? 'border-ui-primary/35 bg-ui-primary/10' : 'border-transparent hover:bg-ui-raised'}`}
                        >
                            <span className='grid h-9 w-9 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                                {icon === 'case' ? <ShieldCheck className='h-4 w-4' /> : null}
                                {icon === 'actor' ? <ActorMark name={item.title} /> : null}
                                {icon === 'route' ? <FileText className='h-4 w-4' /> : null}
                            </span>
                            <span className='min-w-0'>
                                <span className='block truncate text-sm font-semibold text-ui-text'>{item.title}</span>
                                <span className='block truncate text-xs leading-5 text-ui-muted'>{item.detail || item.href}</span>
                            </span>
                        </Link>
                    )
                })}
            </div>
        </section>
    )
}
