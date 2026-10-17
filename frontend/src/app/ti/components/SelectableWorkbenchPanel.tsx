'use client'

import type { HTMLAttributes, ReactNode } from 'react'
import { CompactRowsToggle } from './selectedPreviewList'

type PreviewState = {
    hiddenCount: number
    expanded: boolean
    hasMore: boolean
    setExpanded: (expanded: boolean) => void
}

type SectionProps = HTMLAttributes<HTMLElement> & {
    [attribute: `data-${string}`]: string | undefined
}

export default function SelectableWorkbenchPanel({
    sectionProps,
    title,
    description,
    headerActions,
    columnsClassName,
    detailBreakpoint,
    preview,
    moreLabel,
    lessLabel,
    children,
    detail,
    emptyState,
}: {
    sectionProps: SectionProps
    title: string
    description: string
    headerActions: ReactNode
    columnsClassName: string
    detailBreakpoint: 'lg' | 'xl'
    preview: PreviewState
    moreLabel: (count: number) => string
    lessLabel: string
    children: ReactNode
    detail: ReactNode
    emptyState?: ReactNode
}) {
    const sectionClassName = sectionProps.className || 'min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel dark:border-ui-border dark:bg-ui-panel'

    return (
        <section {...sectionProps} className={sectionClassName}>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>{title}</p>
                    <p className='mt-0.5 hidden wrap-break-word text-xs text-ui-muted dark:text-ui-muted md:block'>{description}</p>
                </div>
                <div className='flex min-w-0 flex-wrap gap-1.5'>{headerActions}</div>
            </div>
            <div className={`grid min-w-0 ${columnsClassName}`}>
                <div className='min-w-0 overflow-x-auto'>
                    {children}
                    <CompactRowsToggle
                        hiddenCount={preview.hiddenCount}
                        expanded={preview.expanded}
                        hasMore={preview.hasMore}
                        onExpandedChange={preview.setExpanded}
                        moreLabel={moreLabel}
                        lessLabel={lessLabel}
                        className='ui-button ui-button-secondary m-2 min-h-9 px-3 text-xs'
                    />
                    {emptyState}
                </div>
                <div className={`min-w-0 border-t border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised ${detailBreakpoint}:border-l ${detailBreakpoint}:border-t-0`}>
                    {detail}
                </div>
            </div>
        </section>
    )
}
