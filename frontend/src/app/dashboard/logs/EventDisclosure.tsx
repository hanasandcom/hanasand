import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

export default function EventDisclosureTrigger({
    id,
    expanded,
    onToggle,
    label,
    buttonClassName,
    iconClassName = '',
}: {
    id: string
    expanded: boolean
    onToggle: () => void
    label: ReactNode
    buttonClassName: string
    iconClassName?: string
}) {
    return <button type='button' onClick={onToggle} aria-expanded={expanded} aria-controls={id} className={buttonClassName}>
        <ChevronDown size={16} aria-hidden className={[iconClassName, !expanded && '-rotate-90'].filter(Boolean).join(' ')} />
        {label}
    </button>
}
