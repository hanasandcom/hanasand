import type { CodeItem } from '@/utils/codeReviewTypes'
import { ItemIcon, StatusIcon } from './codeReviewShared'

export function CodeItemLink({ item, selected = false, onSelect }: {
    item: CodeItem
    selected?: boolean
    onSelect: (id: string) => void
}) {
    return <button aria-current={selected ? 'true' : undefined} onClick={() => onSelect(item.id)}>
        <ItemIcon item={item} />
        <span>{item.title}</span>
        <StatusIcon item={item} />
    </button>
}
