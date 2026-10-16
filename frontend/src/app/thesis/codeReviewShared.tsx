import { Check, Circle, Code2, Database, FileCode2, Globe, RotateCcw } from 'lucide-react'
import { reviewPriority, reviewStatus, type CodeItem } from '@/utils/codeReviewTypes'

export const kinds = ['frontend', 'api', 'database', 'source'] as const
export const names = {
    frontend: 'Frontend',
    api: 'API',
    database: 'Database',
    source: 'Source files',
}
export const icons = {
    frontend: Globe,
    api: Code2,
    database: Database,
    source: FileCode2,
}
export const website = (item: CodeItem) => /^(frontend|api|db)\//.test(item.file)
export const statusNames = {
    approved: 'Approved',
    changed: 'Needs new review',
    unreviewed: 'Not reviewed',
}

export function ItemIcon({ item }: { item: CodeItem }) {
    const Icon = icons[item.kind]
    return <Icon size={15} aria-hidden='true' />
}

export function StatusIcon({ item }: { item: CodeItem }) {
    const status = reviewStatus(item)
    const Icon = status === 'approved'
        ? Check
        : status === 'changed'
            ? RotateCcw
            : Circle
    const iconSize = status === 'unreviewed' ? 10 : 12

    return (
        <span
            className='code-status'
            data-status={status}
            data-priority={reviewPriority(item)}
            title={statusNames[status]}
        >
            <Icon size={iconSize} />
        </span>
    )
}

export function related(item: CodeItem, byId: Map<string, CodeItem>) {
    const visited = new Set<string>()
    const stack = [...item.dependencies]

    while (stack.length) {
        const id = stack.pop()!
        if (visited.has(id) || id === item.id) {
            continue
        }

        visited.add(id)
        stack.push(...(byId.get(id)?.dependencies || []))
    }

    return [...visited]
        .map(id => byId.get(id))
        .filter((node): node is CodeItem => Boolean(node))
        .sort((left, right) => left.title.localeCompare(right.title, 'en'))
}
