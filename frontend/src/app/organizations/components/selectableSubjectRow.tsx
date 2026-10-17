import type { KeyboardEvent, ReactNode } from 'react'

type Props = {
    children: ReactNode
    selected: boolean
    className: string
    onSelect: () => void
    as?: 'article' | 'div' | 'tr'
    id?: string
    dataAttributes?: Record<`data-${string}`, string>
}

export function SelectableSubjectRow({ children, selected, className, onSelect, as = 'div', id, dataAttributes }: Props) {
    const Row = as
    return <Row id={id} role='button' tabIndex={0} aria-pressed={selected} className={className} onClick={onSelect}
        onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect() }
        }} {...dataAttributes}>{children}</Row>
}
